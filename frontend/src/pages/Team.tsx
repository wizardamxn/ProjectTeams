import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { GlassCard } from "@/components/GlassCard";
import { UserPlus, Mail, Edit, Trash2, Crown, User } from "lucide-react";
import { useState } from "react";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
  joinedDate: string;
}

const mockTeamMembers: TeamMember[] = [
  {
    id: "1",
    name: "Alice Chen",
    email: "alice@example.com",
    role: "admin",
    joinedDate: "Jan 2024",
  },
  {
    id: "2",
    name: "Bob Smith",
    email: "bob@example.com",
    role: "member",
    joinedDate: "Feb 2024",
  },
  {
    id: "3",
    name: "Carol White",
    email: "carol@example.com",
    role: "member",
    joinedDate: "Mar 2024",
  },
];

export default function Team() {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    // Placeholder invite logic
    alert(`Invitation sent to ${inviteEmail}`);
    setInviteEmail("");
    setShowInviteModal(false);
  };

  return (
    <div className="min-h-screen relative overflow-hidden p-6">
      {/* Background effects */}
      <div className="absolute inset-0 gradient-radial opacity-50" />
      
      <div className="relative z-10 max-w-7xl mx-auto">
        <Navbar />
        
        <div className="flex gap-6">
          <Sidebar />
          
          <main className="flex-1">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Team Management</h1>
                <p className="text-muted-foreground">Manage your team members and invitations</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowInviteModal(true)}
                className="bg-gradient-purple-blue px-6 py-3 rounded-xl font-semibold flex items-center gap-2 hover:shadow-lg hover:shadow-primary/50 transition-all"
              >
                <UserPlus className="w-5 h-5" />
                Invite Member
              </motion.button>
            </div>

            {/* Team Members Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mockTeamMembers.map((member) => (
                <GlassCard key={member.id}>
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 bg-gradient-purple-blue rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="font-semibold text-lg">
                        {member.name.split(" ").map(n => n[0]).join("")}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg mb-1 truncate">{member.name}</h3>
                      <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    {member.role === "admin" ? (
                      <span className="flex items-center gap-1 px-3 py-1 bg-primary/20 text-primary rounded-lg text-sm">
                        <Crown className="w-3 h-3" />
                        Admin
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-3 py-1 bg-white/5 text-muted-foreground rounded-lg text-sm">
                        <User className="w-3 h-3" />
                        Member
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Joined {member.joinedDate}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex-1 glass-card px-3 py-2 hover:bg-primary/10 transition-colors rounded-lg flex items-center justify-center gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      <span className="text-sm">Edit Role</span>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="glass-card px-3 py-2 hover:bg-destructive/10 transition-colors rounded-lg flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </motion.button>
                  </div>
                </GlassCard>
              ))}
            </div>
          </main>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowInviteModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-card p-8 max-w-md w-full"
          >
            <h2 className="text-2xl font-bold mb-4">Invite Team Member</h2>
            <p className="text-muted-foreground mb-6">
              Send an invitation to join your workspace
            </p>

            <form onSubmit={handleInvite}>
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="glass-input w-full pl-11 pr-4 py-3 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none transition-all"
                    placeholder="colleague@example.com"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 glass-card px-4 py-3 hover:bg-white/5 transition-colors rounded-xl font-semibold"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="flex-1 bg-gradient-purple-blue px-4 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-primary/50 transition-all"
                >
                  Send Invite
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
