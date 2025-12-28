import { motion, AnimatePresence } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { UserPlus, Mail, Trash2, Crown, User, Loader2, X, Shield } from "lucide-react";
import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";

// --- Types ---
interface TeamMember {
  _id: string;
  fullName: string;
  email: string;
  role?: "admin" | "member"; 
  joinedDate?: string;      
}

export default function Team() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setLoading(true);
        const res = await axios.get("http://localhost:2222/teammembers", {
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

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!inviteEmail) return;

    try {
        setSendingInvite(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000)); 
        
        toast.success(`Invitation sent to ${inviteEmail}`);
        setInviteEmail("");
        setShowInviteModal(false);
    } catch (error) {
        toast.error("Failed to send invitation");
    } finally {
        setSendingInvite(false);
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
                  Enter email address to invite a colleague.
                </p>
              </div>

              <form onSubmit={handleInvite}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                        Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-600 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder:text-zinc-600 outline-none transition-all"
                        placeholder="colleague@company.com"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(false)}
                      className="flex-1 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-lg text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={sendingInvite}
                      className="flex-1 px-4 py-2 bg-zinc-100 hover:bg-white text-zinc-950 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {sendingInvite ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                          "Send Invite"
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}