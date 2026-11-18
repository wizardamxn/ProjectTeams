import { Tip } from "@/components/ui/tooltip";
import { confirmDialog } from "@/components/ui/confirm";
import { Select } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Crown,
  DoorExit,
  Edit,
  Link as LinkIcon,
  Loader2,
  Mail,
  Send,
  Shield,
  Trash2,
  UserPlus,
  UserRemove,
  Users,
  X,
} from "@/components/icons";
import {
  useChangeRole,
  useCreateInvite,
  useInvites,
  useLeaveWorkspace,
  useMembers,
  useRemoveMember,
  useRenameWorkspace,
  useRevokeInvite,
} from "@/api/workspaces";
import type { Invite, Member, Role } from "@/api/types";
import { errorMessage } from "@/lib/api";
import { useAppSelector } from "@/store/hooks";
import { isAtLeast } from "@/store/slices/User";

const selectClass = "h-8 px-2 text-xs text-zinc-200";

const ROLE_STYLES: Record<Role, string> = {
  owner: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  admin: "border-sky-500/25 bg-sky-500/10 text-sky-300",
  member: "border-white/10 bg-white/[0.04] text-zinc-400",
};

const RoleBadge = ({ role }: { role: Role }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${ROLE_STYLES[role]}`}
  >
    {role === "owner" ? <Crown className="h-3 w-3" /> : role === "admin" ? <Shield className="h-3 w-3" /> : null}
    {role}
  </span>
);

const Avatar = ({ name, url }: { name: string; url?: string }) =>
  url ? (
    <img src={url} alt="" referrerPolicy="no-referrer" className="h-9 w-9 shrink-0 rounded-full object-cover" />
  ) : (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-zinc-300">
      {name.charAt(0).toUpperCase()}
    </div>
  );

const copy = async (text: string, what = "Link") => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error("Couldn't copy. Select it and copy manually.");
  }
};

export default function Team() {
  const navigate = useNavigate();
  const me = useAppSelector((s) => s.user.user);
  const workspace = useAppSelector((s) => s.user.workspace);
  const myRole = useAppSelector((s) => s.user.role);
  const isAdmin = isAtLeast(myRole, "admin");
  const isOwner = myRole === "owner";

  const { data: members = [], isLoading, error } = useMembers();
  const changeRole = useChangeRole();
  const removeMember = useRemoveMember();
  const rename = useRenameWorkspace();
  const leave = useLeaveWorkspace();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(workspace?.name ?? "");

  useEffect(() => {
    if (error) toast.error(errorMessage(error, "Could not load members"));
  }, [error]);

  const canRemove = (m: Member) =>
    m._id !== me?._id && (isOwner || (myRole === "admin" && m.role === "member"));

  const onRoleChange = async (m: Member, role: Role) => {
    if (
      role === "owner" &&
      !(await confirmDialog({ title: `Make ${m.fullName} the owner?`, body: "You'll become an admin.", action: "Make owner", danger: true }))
    )
      return;
    changeRole.mutate(
      { userId: m._id, role },
      {
        onSuccess: () => toast.success(role === "owner" ? `${m.fullName} is now the owner` : `${m.fullName} is now ${role === "admin" ? "an admin" : "a member"}`),
        onError: (err) => toast.error(errorMessage(err, "Couldn't change the role")),
      },
    );
  };

  const onRemove = async (m: Member) => {
    const ok = await confirmDialog({
      title: `Remove ${m.fullName} from ${workspace?.name}?`,
      body: "They'll lose access right away.",
      action: "Remove",
      danger: true,
    });
    if (!ok) return;
    removeMember.mutate(m._id, {
      onSuccess: () => toast.success(`${m.fullName} was removed`),
      onError: (err) => toast.error(errorMessage(err, "Couldn't remove this member")),
    });
  };

  const onRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim() === workspace?.name) return setEditingName(false);
    rename.mutate(name.trim(), {
      onSuccess: () => {
        setEditingName(false);
        toast.success("Workspace renamed");
      },
      onError: (err) => toast.error(errorMessage(err, "Couldn't rename the workspace")),
    });
  };

  const onLeave = async () => {
    const ok = await confirmDialog({
      title: `Leave ${workspace?.name}?`,
      body: "You'll need a new invite to come back.",
      action: "Leave",
      danger: true,
    });
    if (!ok) return;
    leave.mutate(undefined, {
      onSuccess: () => navigate("/dashboard", { replace: true }),
      onError: (err) => toast.error(errorMessage(err, "Couldn't leave the workspace")),
    });
  };

  return (
    <div className="mx-auto max-w-4xl">
      {/* --- Header --- */}
      <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <span className="text-sm font-semibold uppercase tracking-widest text-emerald-500">Workspace</span>
          {editingName ? (
            <form onSubmit={onRename} className="mt-1 flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                autoFocus
                aria-label="Workspace name"
                className="min-w-0 rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-2xl font-bold text-white outline-none focus:border-emerald-500/50"
              />
              <button type="submit" className="rounded-md bg-emerald-600 p-2 text-white hover:bg-emerald-500" aria-label="Save name">
                {rename.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </button>
              <button type="button" onClick={() => setEditingName(false)} className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800" aria-label="Cancel">
                <X className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <h1 className="truncate text-3xl font-bold tracking-tight text-white">{workspace?.name}</h1>
              {isAdmin && (
                <button
                  onClick={() => {
                    setName(workspace?.name ?? "");
                    setEditingName(true);
                  }}
                  className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-white"
                  aria-label="Rename workspace"
                >
                  <Edit className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
          <p className="mt-2 flex items-center gap-1.5 text-sm text-zinc-500">
            <Users className="h-4 w-4" />
            {members.length} {members.length === 1 ? "member" : "members"} · you're {{ owner: "the owner", admin: "an admin", member: "a member" }[myRole ?? "member"]}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isOwner && (
            <button
              onClick={onLeave}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-400 transition-colors hover:border-red-500/30 hover:text-red-400"
            >
              <DoorExit className="h-4 w-4" /> Leave
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setInviteOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <UserPlus className="h-4 w-4" /> Invite people
            </button>
          )}
        </div>
      </div>

      {/* --- Members --- */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-900/40">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {members.map((m) => (
              <li key={m._id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <Avatar name={m.fullName} url={m.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">
                    {m.fullName}
                    {m._id === me?._id && <span className="ml-1.5 text-xs font-normal text-zinc-500">(you)</span>}
                  </p>
                  <p className="truncate text-xs text-zinc-500">{m.email}</p>
                </div>

                {isOwner && m._id !== me?._id ? (
                  <Select<Role>
                    value={m.role}
                    onChange={(role) => onRoleChange(m, role)}
                    options={[
                      { value: "member", label: "Member" },
                      { value: "admin", label: "Admin" },
                      { value: "owner", label: "Make owner…" },
                    ]}
                    disabled={changeRole.isPending}
                    aria-label={`Role for ${m.fullName}`}
                    className={selectClass}
                  />
                ) : (
                  <RoleBadge role={m.role} />
                )}

                {canRemove(m) ? (
                  <Tip label="Remove from workspace"><button
                    onClick={() => onRemove(m)}
                    className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                    aria-label={`Remove ${m.fullName}`}
                  >
                    <UserRemove className="h-4 w-4" />
                  </button></Tip>
                ) : (
                  <span className="w-7" />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {isAdmin && (
        <p className="mt-3 text-xs text-zinc-500">
          Owners change roles. Admins invite people and remove members. Members can use everything else.
        </p>
      )}

      <AnimatePresence>{inviteOpen && <InviteDialog isOwner={isOwner} onClose={() => setInviteOpen(false)} />}</AnimatePresence>
    </div>
  );
}

/* ================= Invite dialog ================= */

function InviteDialog({ isOwner, onClose }: { isOwner: boolean; onClose: () => void }) {
  const { data: invites = [], isLoading } = useInvites();
  const createInvite = useCreateInvite();
  const revoke = useRevokeInvite();

  const [role, setRole] = useState<"member" | "admin">("member");
  const [days, setDays] = useState(7);
  const [email, setEmail] = useState("");
  const [fresh, setFresh] = useState<Invite | null>(null);

  const makeLink = () =>
    createInvite.mutate(
      { role, expiresInDays: days },
      {
        onSuccess: (invite) => {
          setFresh(invite);
          void copy(invite.url, "Invite link");
        },
        onError: (err) => toast.error(errorMessage(err, "Couldn't create the link")),
      },
    );

  const sendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    createInvite.mutate(
      { role, expiresInDays: days, email: email.trim() },
      {
        onSuccess: () => {
          toast.success(`Invite sent to ${email.trim()}`);
          setEmail("");
        },
        onError: (err) => toast.error(errorMessage(err, "Couldn't send the invite")),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.97, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.97, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Invite people"
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl"
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-zinc-500 hover:text-white" aria-label="Close">
          <X className="h-4 w-4" />
        </button>

        <h2 className="text-lg font-semibold text-white">Invite people</h2>
        <p className="mt-1 text-sm text-zinc-400">Share a link, or send an invite straight to someone's inbox.</p>

        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          Join as
          <Select<"member" | "admin">
            value={role}
            onChange={setRole}
            options={[{ value: "member", label: "Member" }, ...(isOwner ? [{ value: "admin" as const, label: "Admin" }] : [])]}
            className={selectClass}
            aria-label="Role"
          />
          · link works for
          <Select
            value={String(days)}
            onChange={(v) => setDays(Number(v))}
            options={[
              { value: "1", label: "1 day" },
              { value: "7", label: "7 days" },
              { value: "30", label: "30 days" },
            ]}
            className={selectClass}
            aria-label="Expiry"
          />
        </div>

        {/* Link */}
        <div className="mt-4 rounded-xl border border-white/[0.08] bg-zinc-900/50 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-200">
            <LinkIcon className="h-4 w-4 text-emerald-400" /> Invite link
          </div>
          {fresh ? (
            <div className="flex items-center gap-2">
              <input readOnly value={fresh.url} onFocus={(e) => e.target.select()} aria-label="Invite link"
                className="min-w-0 flex-1 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-300" />
              <button onClick={() => copy(fresh.url, "Invite link")} className="flex items-center gap-1.5 rounded-md bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-100 hover:bg-zinc-700">
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
            </div>
          ) : (
            <button
              onClick={makeLink}
              disabled={createInvite.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {createInvite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
              Create and copy link
            </button>
          )}
          <p className="mt-2 text-[11px] text-zinc-500">Anyone with the link can join until it expires or you revoke it.</p>
        </div>

        {/* Email */}
        <form onSubmit={sendEmail} className="mt-3 rounded-xl border border-white/[0.08] bg-zinc-900/50 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-200">
            <Mail className="h-4 w-4 text-emerald-400" /> Invite by email
          </div>
          <div className="flex items-center gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
              aria-label="Email address"
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500/50"
            />
            <button type="submit" disabled={!email.trim() || createInvite.isPending}
              className="flex items-center gap-1.5 rounded-md bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-50">
              <Send className="h-3.5 w-3.5" /> Send
            </button>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">Only that email address can use this invite.</p>
        </form>

        {/* Active */}
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Active invites</h3>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
          ) : invites.length === 0 ? (
            <p className="text-sm text-zinc-500">None yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {invites.map((inv) => (
                <li key={inv._id} className="flex items-center gap-2 rounded-lg border border-white/[0.06] px-3 py-2 text-xs">
                  {inv.email ? <Mail className="h-3.5 w-3.5 shrink-0 text-zinc-500" /> : <LinkIcon className="h-3.5 w-3.5 shrink-0 text-zinc-500" />}
                  <span className="min-w-0 flex-1 truncate text-zinc-300">
                    {inv.email ?? "Shareable link"} · {inv.role} · expires {new Date(inv.expiresAt).toLocaleDateString()}
                    {!inv.email && inv.uses > 0 ? ` · used ${inv.uses}×` : ""}
                  </span>
                  {!inv.email && (
                    <button onClick={() => copy(inv.url, "Invite link")} className="rounded p-1 text-zinc-500 hover:text-white" aria-label="Copy link">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <Tip label="Revoke"><button
                    onClick={() => revoke.mutate(inv._id, { onSuccess: () => toast.success("Invite revoked") })}
                    className="rounded p-1 text-zinc-500 hover:text-red-400"
                    aria-label="Revoke invite"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button></Tip>
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.div>
    </div>
  );
}
