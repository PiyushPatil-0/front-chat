export function timeAgo(date) {
  const now = new Date();

  // FIX: Spring Boot's LocalDateTime serializes as "2026-06-25T08:30:00"
  // with NO timezone suffix. JS then reads it as local time (IST +5:30)
  // instead of UTC — making every message appear ~5.5 hours older.
  // Appending "Z" forces JS to treat it as UTC, which is what the server means.
  let normalized = date;
  if (
    typeof date === "string" &&
    !date.endsWith("Z") &&
    !/[+-]\d{2}:\d{2}$/.test(date)
  ) {
    normalized = date + "Z";
  }

  const past = new Date(normalized);

  // Guard against invalid dates
  if (isNaN(past.getTime())) return "";

  const secondsAgo = Math.floor((now - past) / 1000);

  if (secondsAgo < 5) return "just now";
  if (secondsAgo < 60) return `${secondsAgo} seconds ago`;
  const minutesAgo = Math.floor(secondsAgo / 60);
  if (minutesAgo < 60) return `${minutesAgo} minute${minutesAgo > 1 ? "s" : ""} ago`;
  const hoursAgo = Math.floor(minutesAgo / 60);
  if (hoursAgo < 24) return `${hoursAgo} hour${hoursAgo > 1 ? "s" : ""} ago`;
  const daysAgo = Math.floor(hoursAgo / 24);
  if (daysAgo < 30) return `${daysAgo} day${daysAgo > 1 ? "s" : ""} ago`;
  const monthsAgo = Math.floor(daysAgo / 30);
  if (monthsAgo < 12) return `${monthsAgo} month${monthsAgo > 1 ? "s" : ""} ago`;
  const yearsAgo = Math.floor(monthsAgo / 12);
  return `${yearsAgo} year${yearsAgo > 1 ? "s" : ""} ago`;
}