import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { GlassCard } from "@/components/GlassCard";
import { Send, Circle } from "lucide-react";
import { useEffect, useState } from "react";
import { createSocketConnection } from "@/utils/socket";
import { Link, Outlet, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import axios from "axios";
interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  isCurrentUser: boolean;
}

interface TeamMember {
  _id: string;
  fullName: string;
  email: string;
  teamCode: string;
  online?: boolean;
}

export default function Chat() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const user = useSelector((store: any) => store?.user?.user);


  useEffect(() => {
    // Fetch team members with the same teamCode
    const fetchTeamMembers = async () => {
      try {
        const res = await axios.get("http://localhost:2222/teammembers", {
          withCredentials: true,
        });
        setTeamMembers(res.data);
      } catch (error) {
        console.error("Error fetching team members:", error);
      }
    };
    fetchTeamMembers()
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden p-6">
      {/* Background effects */}
      <div className="absolute inset-0 gradient-radial opacity-50" />

      <div className="relative z-10 max-w-7xl mx-auto">
        <Navbar />

        <div className="flex gap-6">
          <Sidebar />

          <main className="flex-1 flex gap-6">
            {/* Team Members List */}
            <motion.aside
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-card p-4 w-64 h-[calc(100vh-140px)]"
            >
              <h3 className="font-semibold mb-4">Team Members</h3>
              <div className="space-y-2">
                {teamMembers.map((member) => (
                  <Link key={member._id} to={`/chat/${member._id}`}>
                    <motion.div
                      whileHover={{ x: 4 }}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <div className="w-10 h-10 bg-gradient-purple-blue rounded-full flex items-center justify-center flex-shrink-0 relative">
                        <span className="font-semibold">
                          {member.fullName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </span>
                        <Circle
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${
                            member.online
                              ? "fill-green-500 text-green-500"
                              : "fill-gray-500 text-gray-500"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {member.fullName}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {member.email}
                        </div>
                      </div>
                    </motion.div>
                  </Link>
                ))}
              </div>
            </motion.aside>

            {/* Chat Area */}
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

export const ChatMember = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [targetUser, setTargetUser] = useState<TeamMember | null>(null);
  const user = useSelector((store: any) => store?.user?.user);
  const userId = user?._id;
  const { userId: targetUserId } = useParams();
  const [socket, setSocket] = useState<any>(null);

  useEffect(() => {
    if (!userId || !targetUserId) {
      return;
    }

    // Fetch target user details
    const fetchTargetUser = async () => {
      try {
        const response = await fetch(`/api/users/${targetUserId}`);
        const data = await response.json();
        setTargetUser(data.user);
      } catch (error) {
        console.error("Error fetching target user:", error);
      }
    };

    fetchTargetUser();

    // Setup socket connection
    const socketConnection = createSocketConnection();
    setSocket(socketConnection);

    // Create unique room ID (sort IDs to ensure same room for both users)
    const roomId = [userId, targetUserId].sort().join("-");

    socketConnection.emit("joinChat", { userId, targetUserId, roomId });

    // Listen for incoming messages
    socketConnection.on("receiveMessage", (newMessage: Message) => {
      setMessages((prev) => [...prev, newMessage]);
    });

    // Fetch chat history
    const fetchChatHistory = async () => {
      try {
        const response = await fetch(
          `/api/chat/history/${userId}/${targetUserId}`
        );
        const data = await response.json();
        setMessages(data.messages || []);
      } catch (error) {
        console.error("Error fetching chat history:", error);
      }
    };

    fetchChatHistory();

    return () => {
      socketConnection.disconnect();
    };
  }, [userId, targetUserId]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !socket) return;

    const roomId = [userId, targetUserId].sort().join("-");

    const newMessage: Message = {
      id: Date.now().toString(),
      sender: user.fullName,
      content: message,
      timestamp: new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
      isCurrentUser: true,
    };

    // Emit message to socket
    socket.emit("sendMessage", {
      roomId,
      message: newMessage,
      senderId: userId,
      receiverId: targetUserId,
    });

    setMessages((prev) => [...prev, newMessage]);
    setMessage("");
  };

  return (
    <div className="flex-1 flex flex-col">
      <GlassCard className="flex-1 flex flex-col h-[calc(100vh-140px)]">
        {/* Chat Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
          <div>
            <h2 className="text-xl font-semibold">
              {targetUser ? targetUser.fullName : "Loading..."}
            </h2>
            <p className="text-sm text-muted-foreground">{targetUser?.email}</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${
                msg.isCurrentUser ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[70%] ${
                  msg.isCurrentUser ? "order-2" : "order-1"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{msg.sender}</span>
                  <span className="text-xs text-muted-foreground">
                    {msg.timestamp}
                  </span>
                </div>
                <div
                  className={`glass-card p-4 rounded-2xl ${
                    msg.isCurrentUser ? "bg-primary/20 ml-auto" : "bg-white/5"
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Message Input */}
        <form onSubmit={handleSend} className="flex gap-3">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            className="glass-input flex-1 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none transition-all"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            className="bg-gradient-purple-blue px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-primary/50 transition-all flex items-center gap-2"
          >
            <Send className="w-5 h-5" />
            Send
          </motion.button>
        </form>
      </GlassCard>
    </div>
  );
};
