import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Check, ChevronDown, Loader2, Plus } from "@/components/icons";
import { useCreateWorkspace, useSwitchWorkspace } from "@/api/workspaces";
import { errorMessage } from "@/lib/api";
import { useAppSelector } from "@/store/hooks";

/**
 * Current workspace name with a menu to switch to another one or create a new
 * one. `compact` shows only the initial (collapsed sidebar).
 */
export default function WorkspaceSwitcher({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const workspace = useAppSelector((s) => s.user.workspace);
  const workspaces = useAppSelector((s) => s.user.workspaces);
  const switchWs = useSwitchWorkspace();
  const createWs = useCreateWorkspace();

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!workspace) return null;

  const pick = (id: string) => {
    setOpen(false);
    if (id === workspace._id) return;
    switchWs.mutate(id, {
      onSuccess: () => navigate("/dashboard"),
      onError: (err) => toast.error(errorMessage(err, "Couldn't switch workspace")),
    });
  };

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createWs.mutate(name.trim(), {
      onSuccess: () => {
        setOpen(false);
        setCreating(false);
        setName("");
        navigate("/team");
        toast.success("Workspace created. Invite your team next.");
      },
      onError: (err) => toast.error(errorMessage(err, "Couldn't create the workspace")),
    });
  };

  const initial = workspace.name.charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={workspace.name}
        className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-white/5"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white">
          {switchWs.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : initial}
        </span>
        {!compact && (
          <>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">{workspace.name}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 p-1 shadow-2xl"
        >
          <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Workspaces</p>
          {workspaces.map((w) => (
            <button
              key={w._id}
              role="menuitem"
              onClick={() => pick(w._id)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-200 hover:bg-white/5"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-xs font-semibold text-zinc-300">
                {w.name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate">{w.name}</span>
              {w._id === workspace._id && <Check className="h-4 w-4 text-emerald-400" />}
            </button>
          ))}
          <div className="my-1 h-px bg-white/[0.06]" />
          {creating ? (
            <form onSubmit={create} className="flex items-center gap-1.5 p-1.5">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder="Workspace name"
                aria-label="New workspace name"
                className="min-w-0 flex-1 rounded-md border border-white/10 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-emerald-500/50"
              />
              <button type="submit" disabled={createWs.isPending} className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-60">
                {createWs.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create"}
              </button>
            </form>
          ) : (
            <button
              role="menuitem"
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
            >
              <Plus className="h-4 w-4" /> New workspace
            </button>
          )}
        </div>
      )}
    </div>
  );
}
