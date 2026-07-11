import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus,
  Copy,
  Check,
  Trash2,
  User,
  Loader2,
  X,
  Shield,
} from "@/components/icons";
import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useSelector } from "react-redux";
import { WobbleCard } from "@/components/ace/wobble-card";
import { AnimatedTooltip, type TooltipItem } from "@/components/ace/animated-tooltip";
import { HoverBorderGradient } from "@/components/ace/hover-border-gradient";

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
          withCredentials: true,
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
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  const avatarItems: TooltipItem[] = members.slice(0, 8).map((m) => ({
    id: m._id,
    name: m.fullName,
    designation: m.email,
    initials: m.fullName?.charAt(0),
  }));

  return (
    <div className="mx-auto max-w-6xl">
      {/* --- Header --- */}
      <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="text-sm font-semibold uppercase tracking-widest text-emerald-500">
            Your people
          </span>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
            Team Management
          </h1>
          <div className="mt-4 flex items-center gap-4">
            {avatarItems.length > 0 && <AnimatedTooltip items={avatarItems} />}
            <span className="text-sm text-zinc-500">
              {members.length} {members.length === 1 ? "member" : "members"}
            </span>
          </div>
        </div>

        <button onClick={() => setShowInviteModal(true)}>
          <HoverBorderGradient className="px-4 py-2.5 text-sm font-semibold">
            <span className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Invite Member
            </span>
          </HoverBorderGradient>
        </button>
      </div>

      {/* --- Members Grid --- */}
      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-zinc-900/30 py-20">
          <User className="mb-4 h-12 w-12 text-zinc-700" />
          <p className="text-zinc-500">No team members found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {members.map((member, i) => (
            <motion.div
              key={member._id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <WobbleCard containerClassName="h-full">
                <div className="group flex h-full flex-col">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/80 to-teal-600/80 font-semibold text-white">
                        {member.fullName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="max-w-[150px] truncate font-medium text-zinc-100">
                          {member.fullName}
                        </h3>
                        <p className="max-w-[150px] truncate text-xs text-zinc-500">
                          {member.email}
                        </p>
                      </div>
                    </div>
                    <span className="rounded border border-emerald-500/20 bg-emerald-500/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300/80">
                      Member
                    </span>
                  </div>

                  <div className="mt-auto flex items-center justify-between border-t border-white/[0.06] pt-4">
                    <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <Shield className="h-3 w-3" />
                      Active
                    </span>
                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                        title="Remove Member"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </WobbleCard>
            </motion.div>
          ))}
        </div>
      )}

      {/* --- Invite Modal --- */}
      <AnimatePresence>
        {showInviteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl"
            >
              <button
                onClick={() => setShowInviteModal(false)}
                className="absolute right-4 top-4 z-10 text-zinc-500 transition-colors hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="relative z-10">
                <div className="mb-6">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600">
                    <UserPlus className="h-5 w-5 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">
                    Invite Team Member
                  </h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Share this code — your teammate enters it on the signup page
                    to join your team.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-3">
                    <span className="font-mono text-lg tracking-widest text-gradient">
                      {teamCode || "--------"}
                    </span>
                    <button
                      onClick={handleCopyCode}
                      className="flex items-center gap-1.5 rounded-md border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
                  >
                    Done
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
