import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Building, Link as LinkIcon, Loader2, LogOut, AlertCircle } from "@/components/icons";
import AuthShell from "@/components/AuthShell";
import { useCreateWorkspace } from "@/api/workspaces";
import { useLogout } from "@/api/auth";
import { errorMessage } from "@/lib/api";
import { useAppSelector } from "@/store/hooks";

/** Pulls the token out of a pasted invite link (or accepts a bare token). */
const inviteTokenFrom = (input: string) => {
  const trimmed = input.trim();
  const match = /\/invite\/([A-Za-z0-9_-]{16,64})/.exec(trimmed);
  if (match) return match[1];
  return /^[A-Za-z0-9_-]{16,64}$/.test(trimmed) ? trimmed : null;
};

const inputClass =
  "w-full rounded-lg border border-white/10 bg-zinc-950/50 py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50";

/** First stop for a signed-in user who isn't in any workspace yet. */
export default function Onboarding() {
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.user.user);
  const createWorkspace = useCreateWorkspace();
  const logout = useLogout();

  const firstName = user?.fullName.split(" ")[0] ?? "";
  const [name, setName] = useState(firstName ? `${firstName}'s team` : "");
  const [link, setLink] = useState("");
  const [error, setError] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Give your workspace a name.");
    createWorkspace.mutate(name.trim(), {
      onSuccess: () => navigate("/dashboard", { replace: true }),
      onError: (err) => setError(errorMessage(err, "Could not create the workspace.")),
    });
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const token = inviteTokenFrom(link);
    if (!token) return setError("That doesn't look like an invite link. Ask a teammate to send it again.");
    navigate(`/invite/${token}`);
  };

  return (
    <AuthShell>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          {firstName ? `Welcome, ${firstName}` : "Welcome"}
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Start a workspace for your team, or join one you were invited to.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      <form onSubmit={handleCreate} className="glass-card space-y-3 p-6 shadow-2xl">
        <h2 className="text-sm font-semibold text-zinc-100">Create a workspace</h2>
        <div className="group relative">
          <Building className="absolute left-3 top-3 h-4 w-4 text-zinc-500 group-focus-within:text-emerald-400" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Acme Inc"
            aria-label="Workspace name"
            className={inputClass}
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={createWorkspace.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {createWorkspace.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          Create workspace
        </button>
        <p className="text-xs text-zinc-500">You'll be the owner and can invite people next.</p>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-zinc-600">
        <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
      </div>

      <form onSubmit={handleJoin} className="glass-card space-y-3 p-6">
        <h2 className="text-sm font-semibold text-zinc-100">Join with an invite link</h2>
        <div className="group relative">
          <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-zinc-500 group-focus-within:text-emerald-400" />
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Paste the link your teammate sent"
            aria-label="Invite link"
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg border border-white/10 bg-zinc-900 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
        >
          Continue
        </button>
      </form>

      <button
        onClick={() => logout.mutate(undefined, { onSettled: () => navigate("/login", { replace: true }) })}
        className="mx-auto mt-6 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300"
      >
        <LogOut className="h-3.5 w-3.5" /> Sign out{user ? ` (${user.email})` : ""}
      </button>
    </AuthShell>
  );
}
