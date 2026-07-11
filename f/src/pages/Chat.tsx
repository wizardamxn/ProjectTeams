import { motion } from "framer-motion";
import { Loader2, User, ArrowLeft, Send } from "@/components/icons";
import { useEffect, useState, useRef } from "react";
import {
  Link,
  Outlet,
  useParams,
  useLocation,
  useOutletContext,
} from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import { joinChat, sendMessage, setHistory } from "@/store/slices/SocketThunks";

// --- Types ---
interface TeamMember {
  _id: string;
  fullName: string;
  email: string;
  teamCode: string;
}

interface SocketMessage {
  chatId: string;
  message: {
    text: string;
    senderId: string;
    senderName: string;
    timestamp?: string;
  };
}

// --- Date Helpers ---
const isSameDay = (d1?: string, d2?: string) => {
  if (!d1 || !d2) return false;
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

const formatDaySeparator = (dateString?: string) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date.toString(), today.toString())) return "Today";
  if (isSameDay(date.toString(), yesterday.toString())) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
};

// ==========================================
// 1. CHAT LAYOUT (PARENT)
// ==========================================
export default function Chat() {
  const backendURL = import.meta.env.VITE_BACKEND_URL;

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const location = useLocation();

  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        const res = await axios.get(`${backendURL}/api/profile/teammembers`, {
          withCredentials: true,
        });
        console.log(res.data)
        setTeamMembers(res.data);
      } catch (error) {
        console.error("Error fetching team members:", error);
      }
    };
    fetchTeamMembers();
  }, []);
  // useEffect(() => {
  //   teamMembers.sort()
  // }, [])
  const isActive = (id: string) => location.pathname.includes(`/chat/${id}`);
  const isChatOpen = location.pathname.split("/").length > 2;

  return (
    <div className="h-[100dvh] overflow-hidden bg-zinc-950 text-zinc-100 md:h-screen md:rounded-2xl md:border md:border-white/[0.06]">
      <div className="relative flex h-full">
        {/* Sidebar List */}
        <aside
          className={`absolute z-10 h-full w-full flex-col border-r border-white/[0.06] bg-zinc-900/40 md:relative md:flex md:w-80 ${
            isChatOpen ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/[0.06] bg-zinc-900/60 px-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Messages
            </h3>
          </div>

          <div className="custom-scrollbar flex-1 space-y-1 overflow-y-auto p-2">
            {teamMembers.map((member) => {
              const active = isActive(member._id);
              return (
                <Link key={member._id} to={"/chat/" + member._id}>
                  <div className="relative flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-colors">
                    {active && (
                      <motion.div
                        layoutId="chat-active"
                        className="absolute inset-0 rounded-lg border border-emerald-500/20 bg-emerald-500/10"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <div className="relative z-10 shrink-0">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                          active
                            ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {member.fullName.charAt(0)}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-950 bg-emerald-500" />
                    </div>

                    <div className="relative z-10 min-w-0 flex-1">
                      <div
                        className={`truncate text-sm font-medium ${
                          active ? "text-zinc-100" : "text-zinc-300"
                        }`}
                      >
                        {member.fullName}
                      </div>
                      <div className="truncate text-xs text-zinc-500">
                        {member.email}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </aside>

        {/* Chat Window Wrapper */}
        <main
          className={`relative flex min-w-0 flex-1 flex-col overflow-hidden bg-zinc-950 ${
            !isChatOpen ? "hidden md:flex" : "flex"
          }`}
        >
          <Outlet context={{ teamMembers }} key={location.pathname} />
        </main>
      </div>
    </div>
  );
}

// ==========================================
// 2. CHAT MEMBER (CHILD)
// ==========================================
export const ChatMember = () => {
  const backendURL = import.meta.env.VITE_BACKEND_URL;

  const { teamMembers } = useOutletContext<{ teamMembers: TeamMember[] }>();

  const dispatch = useDispatch();
  const { userId: targetUserId } = useParams();

  const user = useSelector((store: any) => store?.user?.user);
  const userId = user?._id;
  const senderName = user?.fullName;

  const messages = useSelector((state: any) => state?.chat?.messages);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [messageText, setMessageText] = useState("");

  const targetUser = teamMembers.find((m) => m._id === targetUserId);

  useEffect(() => {
    if (!userId || !targetUserId) return;
    dispatch(setHistory([]));
    setIsLoading(true);

    const loadChatFlow = async () => {
      try {
        const res = await axios.get(
          `${backendURL}/api/chat/chat/${userId}/${targetUserId}`,
          { withCredentials: true },
        );
        const data = res.data;
        const formattedHistory: SocketMessage[] = data.messages.map(
          (msg: any) => ({
            chatId: data._id,
            message: {
              text: msg.text,
              senderId: msg.senderId,
              senderName: msg.senderName,
              timestamp: msg.createdAt,
            },
          }),
        );
        dispatch(setHistory(formattedHistory));
        dispatch(joinChat(userId, targetUserId));
      } catch (error) {
        console.error("Chat load error", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadChatFlow();
  }, [userId, targetUserId, dispatch]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    dispatch(
      sendMessage({
        senderName,
        userId,
        targetUserId,
        text: text.trim(),
      }),
    );
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;
    handleSend(messageText);
    setMessageText("");
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!targetUserId) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-zinc-950 text-zinc-500">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-zinc-900">
          <User className="h-8 w-8 opacity-20" />
        </div>
        <p className="text-sm">Select a team member to view conversation</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-zinc-950">
      {/* 1. Header */}
      <div className="z-20 flex h-16 shrink-0 items-center border-b border-white/[0.06] bg-zinc-900/60 px-4 backdrop-blur-sm md:px-6">
        <div className="flex w-full items-center gap-3">
          <Link
            to="/chat"
            className="-ml-2 p-2 text-zinc-400 hover:text-white md:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-bold text-white">
            {targetUser?.fullName?.[0] || targetUserId[0]}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">
              {targetUser?.fullName || "Loading…"}
            </h3>
            <div className="mt-0.5 flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Scrollable Messages */}
      <div className="custom-scrollbar min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain bg-zinc-950 p-4 md:p-6">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
          </div>
        ) : (
          messages.map((msg: any, index: number) => {
            if (!msg?.message) return null;
            const isMe = msg.message.senderId === userId;
            const showDateSeparator =
              index === 0 ||
              !isSameDay(
                msg.message.timestamp,
                messages[index - 1]?.message?.timestamp,
              );

            return (
              <div key={index} className="w-full">
                {showDateSeparator && (
                  <div className="sticky top-2 z-0 my-6 flex justify-center">
                    <span className="rounded-full border border-white/10 bg-zinc-800/80 px-3 py-1 text-[10px] font-medium text-zinc-400 backdrop-blur-sm">
                      {formatDaySeparator(msg.message.timestamp)}
                    </span>
                  </div>
                )}

                <div
                  className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex max-w-[75%] flex-col md:max-w-[60%] ${
                      isMe ? "items-end" : "items-start"
                    }`}
                  >
                    {!isMe && (
                      <span className="mb-1 ml-1 text-[11px] font-medium text-zinc-500">
                        {msg.message.senderName}
                      </span>
                    )}
                    <div
                      className={`rounded-2xl px-4 py-2 text-[15px] shadow-sm md:text-sm ${
                        isMe
                          ? "rounded-tr-sm bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
                          : "rounded-tl-sm border border-white/[0.06] bg-zinc-800 text-zinc-200"
                      }`}
                    >
                      {msg.message.text}
                    </div>
                    <span className="mt-1 px-1 text-[10px] text-zinc-600">
                      {formatTime(msg.message.timestamp)}
                    </span>
                  </motion.div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} className="h-px" />
      </div>

      {/* 3. Input Area */}
      <div className="z-20 shrink-0 border-t border-white/[0.06] bg-zinc-900/30 p-3 backdrop-blur-sm md:p-4">
        <form onSubmit={handleFormSubmit} className="flex items-center gap-3">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder={`Message ${targetUser?.fullName?.split(" ")[0] || ""}…`}
            className="flex-1 rounded-full border border-white/10 bg-zinc-900 px-5 py-3 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-500/50"
          />
          <button
            type="submit"
            disabled={!messageText.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
            aria-label="Send message"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  );
};
