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

  const inputRef = useRef(null);       // FIX 1: inputRef was defined but never attached
  const chatBoxRef = useRef(null);
  const stompClientRef = useRef(null); // FIX 2: useRef instead of useState — avoids stale closures & unnecessary re-renders

  // Redirect if not connected
  useEffect(() => {
    if (!connected) {
      navigate("/");
    }
  }, [connected, navigate]); // FIX 3: added navigate to deps

  // Load previous messages
  useEffect(() => {
    if (!connected) return;

    async function loadMessages() {
      setLoading(true);
      try {
        const data = await getMessagess(roomId);
        setMessages(data);
      } catch (error) {
        toast.error("Failed to load messages"); // FIX 4: empty catch block replaced with error toast
      } finally {
        setLoading(false);
      }
    }

    loadMessages();
  }, [roomId, connected]); // FIX 5: added roomId & connected to deps (were missing)

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

    client.debug = () => { }; // FIX 6: suppress noisy STOMP logs in console

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
        // FIX 7: was missing error callback entirely
        console.error("WebSocket error:", error);
        toast.error("Connection lost. Please rejoin the room.");
      }
    );

    // FIX 8: cleanup was completely missing — caused memory leaks & duplicate subscriptions
    return () => {
      if (stompClientRef.current && stompClientRef.current.connected) {
        stompClientRef.current.disconnect();
      }
    };
  }, [roomId, connected]); // FIX 9: added connected to deps

  // Send message
  const sendMessage = useCallback(() => {
    // FIX 10: was using stompClient state (stale) — now uses ref
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
    inputRef.current?.focus(); // FIX 11: refocus input after sending
  }, [input, currentUser, roomId]);

  // Leave room
  function handleLogout() {
    // FIX 12: was crashing if stompClient was null — added null + connected check
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
      {/* Header */}
      <header className="dark:border-gray-700 fixed w-full dark:bg-gray-900 py-5 shadow flex justify-around items-center z-10">
        {/* FIX 13: added z-10 so header doesn't get hidden under chat content */}
        <div>
          <h1 className="text-xl font-semibold">
            Room: <span>{roomId}</span>
          </h1>
        </div>
        <div>
          <h1 className="text-xl font-semibold">
            User: <span>{currentUser}</span>
          </h1>
        </div>
        <div>
          <button
            onClick={handleLogout}
            className="dark:bg-red-500 dark:hover:bg-red-700 px-3 py-2 rounded-full"
          >
            Leave Room
          </button>
        </div>
      </header>

      {/* Messages */}
      <main
        ref={chatBoxRef}
        className="py-20 px-10 w-2/3 dark:bg-slate-600 mx-auto h-screen overflow-auto"
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
                } p-2 max-w-xs rounded`}
            >
              <div className="flex flex-row gap-2">
                <img
                  className="h-10 w-10 rounded-full"
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${message.sender}`}
                  alt={message.sender}
                />
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-bold">{message.sender}</p>
                  <p>{message.content}</p>
                  <p className="text-xs text-gray-400">
                    {/* FIX 14: guard against null/undefined timestamp crashing timeAgo() */}
                    {message.timeStamp ? timeAgo(message.timeStamp) : ""}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </main>

      {/* Input area */}
      <div className="fixed bottom-4 w-full h-16">
        <div className="h-full pr-10 gap-4 flex items-center justify-between rounded-full w-1/2 mx-auto dark:bg-gray-900">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
            type="text"
            placeholder="Type your message here..."
            className="w-full dark:border-gray-600 dark:bg-gray-800 px-5 py-2 rounded-full h-full focus:outline-none"
          />
          <div className="flex gap-1">
            <button className="dark:bg-purple-600 h-10 w-10 flex justify-center items-center rounded-full">
              <MdAttachFile size={20} />
            </button>
            <button
              onClick={sendMessage}
              className="dark:bg-green-600 h-10 w-10 flex justify-center items-center rounded-full"
            >
              <MdSend size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;