import { motion, AnimatePresence } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { UserPlus, Copy, Check, Trash2, Crown, User, Loader2, X, Shield } from "lucide-react";
import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useSelector } from "react-redux";

// --- Types ---
interface TeamMember {
  _id: string;
  fullName: string;
  email: string;
  role?: "admin" | "member"; 
  joinedDate?: string;      
}

export default function Team() {
  const backendURL = import.meta.env.VITE_BACKEND_URL;
  const teamCode = useSelector((store: any) => store?.user?.user?.teamCode);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${backendURL}/api/profile/teammembers`, {
            withCredentials: true
        });
        setMembers(res.data);
      } catch (error) {
        console.error("Failed to fetch team", error);
        toast.error("Could not load team members");
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, []);

  const handleCopyCode = async () => {
    if (!teamCode) return;
    try {
      await navigator.clipboard.writeText(teamCode);
      setCopied(true);
      toast.success("Team code copied");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy code");
    }
  };

  if (loading) {
    return (
        <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-zinc-800">
      {/* FIX: Added `p-4` here to match Dashboard layout. 
         This ensures the Navbar and Sidebar align perfectly with other pages.
      */}
      <div className="max-w-[1600px] mx-auto p-4 min-h-screen flex flex-col">
        
        {/* Navbar */}
       

        {/* FIX: Removed `p-4 md:p-0` from here. 
           The gap and margin now match the parent container flow.
        */}
        <div className="flex flex-1 gap-6 min-h-0 mt-4">
         
          <main className="flex-1 w-full">
            
            {/* --- Header --- */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-white">Team Management</h1>
                <p className="text-sm text-zinc-400 mt-1">
                  Manage members, roles, and pending invitations.
                </p>
              </div>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowInviteModal(true)}
                className="bg-zinc-100 hover:bg-white text-zinc-950 px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 shadow-sm transition-colors whitespace-nowrap"
              >
                <UserPlus className="w-4 h-4" />
                <span>Invite Member</span>
              </motion.button>
            </div>

            {/* --- Members Grid --- */}
            {members.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-xl">
                    <User className="w-12 h-12 text-zinc-700 mb-4" />
                    <p className="text-zinc-500">No team members found.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {members.map((member) => (
                    <div 
                        key={member._id}
                        className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-5 hover:bg-zinc-900 transition-colors group"
                    >
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 font-semibold">
                                {member.fullName.charAt(0)}
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-medium text-zinc-200 truncate max-w-[150px]">
                                    {member.fullName}
                                </h3>
                                <p className="text-xs text-zinc-500 truncate max-w-[150px]">
                                    {member.email}
                                </p>
                            </div>
                        </div>
                        
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700 uppercase tracking-wide">
                            Member
                        </span>
                    </div>

                    <div className="pt-4 border-t border-zinc-800/50 flex items-center justify-between">
                        <span className="text-xs text-zinc-600 flex items-center gap-1.5">
                            <Shield className="w-3 h-3" />
                            Active
                        </span>
                        
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                            <button className="p-1.5 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 rounded transition-colors" title="Remove Member">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                    </div>
                ))}
                </div>
            )}
            
          </main>
        </div>
      </div>

      {/* --- Invite Modal --- */}
      <AnimatePresence>
        {showInviteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#09090b] border border-zinc-800 rounded-xl p-6 max-w-md w-full shadow-2xl relative"
            >
                <button 
                    onClick={() => setShowInviteModal(false)}
                    className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>

              <div className="mb-6">
                <div className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center mb-4">
                    <UserPlus className="w-5 h-5 text-zinc-100" />
                </div>
                <h2 className="text-lg font-semibold text-white">Invite Team Member</h2>
                <p className="text-sm text-zinc-400 mt-1">
                  Share this code — your teammate enters it on the signup page to join your team.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3">
                  <span className="font-mono text-lg tracking-widest text-white">
                    {teamCode || "--------"}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-md text-xs font-medium transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </>
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="w-full px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}