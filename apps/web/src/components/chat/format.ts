import type { Conversation, Message } from "@/api/types";

export const isSameDay = (a: string | Date, b: string | Date) => new Date(a).toDateString() === new Date(b).toDateString();

export const dayLabel = (date: string | Date) => {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
};

export const timeLabel = (date: string | Date) =>
  new Date(date).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** "#design", "Priya Nair", or "Priya, Dev and Ana". */
export const conversationTitle = (c: Pick<Conversation, "type" | "name" | "members">) => {
  if (c.type === "channel") return `#${c.name}`;
  const names = c.members.map((m) => m.fullName.split(" ")[0]);
  if (c.type === "dm") return c.members[0]?.fullName ?? "Just you";
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
};

export const fileSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const GROUP_WINDOW_MS = 5 * 60 * 1000;

/** Same sender, same day, within a few minutes, and the previous one didn't start a thread. */
export const isCompact = (msg: Message, prev: Message | undefined) =>
  Boolean(
    prev &&
      prev.sender._id === msg.sender._id &&
      !prev.deleted &&
      prev.replyCount === 0 &&
      isSameDay(prev.createdAt, msg.createdAt) &&
      new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < GROUP_WINDOW_MS,
  );

