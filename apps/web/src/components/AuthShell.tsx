import { ReactNode } from "react";
import { motion } from "framer-motion";
import { MessageSquare, FileText, Database, Users } from "@/components/icons";

const highlights = [
  { icon: MessageSquare, label: "Real-time team chat" },
  { icon: FileText, label: "Collaborative documents" },
  { icon: Database, label: "AI knowledge base" },
  { icon: Users, label: "Live presence" },
];

/**
 * Split-screen auth layout: form on the left, a clean brand panel on the
 * right. The right panel collapses on mobile.
 */
export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] bg-zinc-950 lg:grid-cols-2">
      {/* Left — form */}
      <div className="relative flex items-center justify-center p-4 sm:p-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative z-10 w-full max-w-[400px]"
        >
          {children}
        </motion.div>
      </div>

      {/* Right — brand panel */}
      <div className="relative hidden flex-col items-start justify-center border-l border-white/[0.06] bg-zinc-900/30 p-12 lg:flex">
        <div className="bg-grid mask-radial-faded pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative z-10 max-w-md">
          <div className="mb-8">
            <span className="text-xl font-bold tracking-tight text-white">
              Project Teams
            </span>
          </div>

          <h2 className="text-4xl font-bold leading-tight tracking-tight text-white">
            The workspace where your team{" "}
            <span className="text-emerald-400">thinks together.</span>
          </h2>
          <p className="mt-4 text-zinc-400">
            Chat, co-write documents, and query your own AI knowledge base — one
            calm surface for your whole team.
          </p>

          <div className="mt-10 space-y-4">
            {highlights.map((h, i) => (
              <motion.div
                key={h.label}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="flex items-center gap-3 text-zinc-200"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-emerald-400">
                  <h.icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">{h.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
