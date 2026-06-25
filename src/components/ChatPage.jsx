import React, { useEffect, useRef, useState, useCallback } from "react";
import { MdAttachFile, MdSend } from "react-icons/md";
import useChatContext from "../context/ChatContext";
import { useNavigate } from "react-router";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";
import toast from "react-hot-toast";
import { baseURL } from "../config/AxiosHelper";
import { getMessagess } from "../services/RoomService";
import { timeAgo } from "../config/helper";

const ChatPage = () => {
  const {
    roomId,
    currentUser,
    connected,
    setConnected,
    setRoomId,
    setCurrentUser,
  } = useChatContext();

  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const inputRef = useRef(null);
  const chatBoxRef = useRef(null);
  const stompClientRef = useRef(null);

  // Redirect if not connected
  useEffect(() => {
    if (!connected) {
      navigate("/");
    }
  }, [connected, navigate]);

  // Load previous messages
  useEffect(() => {
    if (!connected) return;

    async function loadMessages() {
      setLoading(true);
      try {
        const data = await getMessagess(roomId);
        setMessages(data);
      } catch (error) {
        toast.error("Failed to load messages");
      } finally {
        setLoading(false);
      }
    }

    loadMessages();
  }, [roomId, connected]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scroll({
        top: chatBoxRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  // WebSocket connection + cleanup
  useEffect(() => {
    if (!connected) return;

    const sock = new SockJS(`${baseURL}/chat`);
    const client = Stomp.over(sock);

    client.debug = () => { };

    client.connect(
      {},
      () => {
        stompClientRef.current = client;
        toast.success("Connected to room!");

        client.subscribe(`/topic/room/${roomId}`, (message) => {
          const newMessage = JSON.parse(message.body);
          setMessages((prev) => [...prev, newMessage]);
        });
      },
      (error) => {
        console.error("WebSocket error:", error);
        toast.error("Connection lost. Please rejoin the room.");
      }
    );

    return () => {
      if (stompClientRef.current && stompClientRef.current.connected) {
        stompClientRef.current.disconnect();
      }
    };
  }, [roomId, connected]);

  // Send message
  const sendMessage = useCallback(() => {
    if (
      !stompClientRef.current ||
      !stompClientRef.current.connected ||
      !input.trim()
    )
      return;

    const message = {
      sender: currentUser,
      content: input.trim(),
      roomId: roomId,
    };

    stompClientRef.current.send(
      `/app/sendMessage/${roomId}`,
      {},
      JSON.stringify(message)
    );

    setInput("");
    // NOTE: removed inputRef.current?.focus() here — on mobile this
    // re-triggers the keyboard in a way that causes layout jumps
  }, [input, currentUser, roomId]);

  // Leave room
  function handleLogout() {
    if (stompClientRef.current && stompClientRef.current.connected) {
      stompClientRef.current.disconnect();
    }
    setConnected(false);
    setRoomId("");
    setCurrentUser("");
    navigate("/");
  }

  return (
    <div>
      {/* ── Header ── */}
      <header className="dark:border-gray-700 fixed w-full dark:bg-gray-900 py-3 sm:py-5 shadow flex justify-around items-center z-10">
        <div>
          {/* FIX: text-sm on mobile, text-xl on sm+ */}
          <h1 className="text-sm sm:text-xl font-semibold">
            Room: <span className="truncate max-w-[80px] sm:max-w-none inline-block align-bottom">{roomId}</span>
          </h1>
        </div>
        <div>
          <h1 className="text-sm sm:text-xl font-semibold">
            User: <span>{currentUser}</span>
          </h1>
        </div>
        <div>
          <button
            onClick={handleLogout}
            className="dark:bg-red-500 dark:hover:bg-red-700 px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-base rounded-full"
          >
            Leave Room
          </button>
        </div>
      </header>

      {/* ── Messages area ── */}
      {/* FIX: w-full on mobile, w-2/3 on sm+ | px-4 on mobile, px-10 on sm+ */}
      <main
        ref={chatBoxRef}
        className="py-20 px-4 sm:px-10 w-full sm:w-2/3 dark:bg-slate-600 mx-auto h-screen overflow-auto"
      >
        {loading && (
          <div className="flex justify-center items-center py-10">
            <p className="text-gray-400">Loading messages...</p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.sender === currentUser ? "justify-end" : "justify-start"
              }`}
          >
            <div
              className={`my-2 ${message.sender === currentUser ? "bg-green-800" : "bg-gray-800"
                } p-2 max-w-[80%] sm:max-w-xs rounded`}
            // FIX: max-w-[80%] on mobile instead of fixed max-w-xs
            >
              <div className="flex flex-row gap-2">
                {/* FIX: flex-shrink-0 prevents avatar from squishing */}
                <img
                  className="h-8 w-8 sm:h-10 sm:w-10 rounded-full flex-shrink-0 self-start"
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${message.sender}`}
                  alt={message.sender}
                />
                {/* FIX: min-w-0 allows text to wrap instead of overflow */}
                <div className="flex flex-col gap-1 min-w-0">
                  <p className="text-sm font-bold truncate">{message.sender}</p>
                  {/* FIX: break-words stops long words from overflowing bubble */}
                  <p className="break-words">{message.content}</p>
                  <p className="text-xs text-gray-400">
                    {message.timeStamp ? timeAgo(message.timeStamp) : ""}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </main>

      {/* ── Input bar ── */}
      {/* FIX: w-full on mobile, w-1/2 on sm+ | px-3 on mobile, pr-10 on sm+ */}
      <div className="fixed bottom-4 w-full h-16 px-2 sm:px-0">
        <div className="h-full px-3 sm:pr-10 gap-2 sm:gap-4 flex items-center justify-between rounded-full w-full sm:w-1/2 mx-auto dark:bg-gray-900">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
            type="text"
            placeholder="Type your message..."
            // ★ THE REVERSED-TEXT FIX ★
            // These 5 attributes stop iOS/Android IME from corrupting
            // cursor position in React controlled inputs:
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            dir="ltr"
            className="w-full dark:border-gray-600 dark:bg-gray-800 px-4 sm:px-5 py-2 rounded-full h-full focus:outline-none text-sm sm:text-base"
          />
          <div className="flex gap-1 flex-shrink-0">
            <button className="dark:bg-purple-600 h-9 w-9 sm:h-10 sm:w-10 flex justify-center items-center rounded-full">
              <MdAttachFile size={18} />
            </button>
            <button
              onClick={sendMessage}
              className="dark:bg-green-600 h-9 w-9 sm:h-10 sm:w-10 flex justify-center items-center rounded-full"
            >
              <MdSend size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;