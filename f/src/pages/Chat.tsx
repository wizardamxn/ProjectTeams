import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { Send, Loader2, User, ArrowLeft } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { Link, Outlet, useParams, useLocation, useOutletContext } from "react-router-dom";
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
        const res = await axios.get(`${backendURL}/teammembers`, {
          withCredentials: true,
        });
        setTeamMembers(res.data);
      } catch (error) {
        console.error("Error fetching team members:", error);
      }
    };
    fetchTeamMembers();
  }, []);

  const isActive = (id: string) => location.pathname.includes(`/chat/${id}`);
  const isChatOpen = location.pathname.split("/").length > 2;

  return (
    <div className="h-[calc(100vh-64px)] md:h-[calc(100vh-96px)] bg-[#09090b] text-zinc-100 font-sans selection:bg-zinc-800 overflow-hidden rounded-xl border border-zinc-800">
      <div className="flex h-full relative">
        {/* Sidebar List */}
        <aside
          className={`
               flex-col bg-zinc-900/50 border-r border-zinc-800 w-full md:w-80 absolute md:relative z-10 h-full
               ${isChatOpen ? "hidden md:flex" : "flex"}
            `}
        >
          <div className="p-4 border-b border-zinc-800 bg-zinc-900 flex justify-between items-center shrink-0 h-16">
            <h3 className="font-medium text-sm text-zinc-400 uppercase tracking-wider">
              Messages
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {teamMembers.map((member) => (
              <Link key={member._id} to={"/chat/" + member._id}>
                <div
                  className={`flex items-center gap-3 p-3 rounded-md transition-all cursor-pointer ${
                    isActive(member._id)
                      ? "bg-zinc-800 border-zinc-700 shadow-sm"
                      : "hover:bg-zinc-800/50 border border-transparent"
                  }`}
                >
                  <div className="relative shrink-0">
                    <div
                      className={`w-10 h-10 md:w-9 md:h-9 rounded-full md:rounded bg-zinc-700 flex items-center justify-center text-sm font-medium ${
                        isActive(member._id) ? "text-white" : "text-zinc-400"
                      }`}
                    >
                      {member.fullName.charAt(0)}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 md:-bottom-1 md:-right-1 w-3 h-3 md:w-2.5 md:h-2.5 bg-emerald-500 rounded-full border-2 border-[#09090b]" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-base md:text-sm font-medium truncate ${
                        isActive(member._id) ? "text-zinc-100" : "text-zinc-400"
                      }`}
                    >
                      {member.fullName}
                    </div>
                    <div className="text-sm md:text-xs text-zinc-500 truncate">
                      {member.email}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </aside>
        
        {/* Chat Window Wrapper */}
        <main
          className={`
            flex-1 flex flex-col min-w-0 bg-[#09090b] relative overflow-hidden
            ${!isChatOpen ? "hidden md:flex" : "flex"}
          `}
        >
          {/* OPTIMIZATION: Passing teamMembers to child to avoid double fetching */}
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
  
  // FIX: Receive data from parent
  const { teamMembers } = useOutletContext<{ teamMembers: TeamMember[] }>();
  
  const [messageText, setMessageText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const dispatch = useDispatch();
  const { userId: targetUserId } = useParams();

  const user = useSelector((store: any) => store?.user?.user);
  const userId = user?._id;
  const senderName = user?.fullName;

  const messages = useSelector((state: any) => state?.chat?.messages);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // FIX: Derived state (Faster than fetching again)
  const targetUser = teamMembers.find(m => m._id === targetUserId);

  useEffect(() => {
    // 1. Safety checks
    if (!userId || !targetUserId) return;

    // 2. LOGIC FIX: Clear old messages IMMEDIATELY so the user doesn't see "ghost" chats
    dispatch(setHistory([])); 
    setIsLoading(true);

    const loadChatFlow = async () => {
      try {
        // 3. LOGIC FIX: Await history FIRST
        const res = await axios.get(
          `${backendURL}/chat/${userId}/${targetUserId}`,
          { withCredentials: true }
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
          })
        );
        
        // 4. Set History
        dispatch(setHistory(formattedHistory));

        // 5. LOGIC FIX: Join socket AFTER history is loaded to prevent race conditions
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

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    dispatch(
      sendMessage({
        senderName,
        userId,
        targetUserId,
        text: messageText,
      })
    );
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
      <div className="h-full flex flex-col items-center justify-center text-zinc-500 bg-[#09090b]">
        <User className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-sm">Select a team member to view conversation</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b]">
      {/* 1. Header */}
      <div className="shrink-0 h-16 px-4 md:px-6 border-b border-zinc-800 flex items-center bg-zinc-900/95 backdrop-blur-sm z-20">
        <div className="flex items-center gap-3 w-full">
          <Link
            to="/chat"
            className="md:hidden p-2 -ml-2 text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-400 font-bold border border-zinc-700">
            {targetUser?.fullName?.[0] || targetUserId[0]}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">
              {targetUser?.fullName || "Loading..."}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
                Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Scrollable Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-[#09090b] custom-scrollbar overscroll-contain min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
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
                  <div className="flex justify-center my-6 sticky top-2 z-0">
                    <span className="bg-zinc-800/80 backdrop-blur-sm border border-zinc-700/50 text-zinc-400 text-[10px] font-medium px-3 py-1 rounded-full shadow-sm">
                      {formatDaySeparator(msg.message.timestamp)}
                    </span>
                  </div>
                )}

                <div
                  className={`flex w-full ${
                    isMe ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`flex flex-col max-w-[75%] md:max-w-[60%] ${
                      isMe ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`flex items-baseline gap-2 mb-1 ${
                        isMe ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      {!isMe && (
                        <span className="text-[11px] text-zinc-500 font-medium ml-1">
                          {msg.message.senderName}
                        </span>
                      )}
                    </div>

                    <div
                      className={`px-4 py-2 text-[15px] md:text-sm rounded-2xl shadow-sm ${
                        isMe
                          ? "bg-zinc-100 text-zinc-900 font-normal rounded-tr-none"
                          : "bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-tl-none"
                      }`}
                    >
                      {msg.message.text}
                    </div>
                    <span className="text-[10px] text-zinc-600 mt-1 px-1">
                      {formatTime(msg.message.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} className="h-px" />
      </div>

      {/* 3. Input Area */}
      <div className="shrink-0 p-3 md:p-4 border-t border-zinc-800 bg-zinc-900/30 backdrop-blur-sm z-20">
        <form onSubmit={handleSend} className="flex gap-3">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Message..."
            className="flex-1 bg-zinc-900 border border-zinc-700 focus:border-zinc-500 rounded-full px-5 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={!messageText.trim()}
            className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200 w-11 h-11 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            <Send className="w-5 h-5 ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
};