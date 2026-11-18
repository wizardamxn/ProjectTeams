import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Check, Hash, Loader2, Lock, Search, X } from "@/components/icons";
import { useAddMembers, useBrowseChannels, useCreateChannel, useJoinChannel, useOpenDirect } from "@/api/chat";
import { useTeamMembers } from "@/api/team";
import type { Person } from "@/api/types";
import { errorMessage } from "@/lib/api";
import { Avatar } from "./Avatar";

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-500 hover:text-white" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500/50";
const primaryButton =
  "flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50";

/* ---------------- New channel ---------------- */

export function NewChannelDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const create = useCreateChannel();
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const slug = name.trim().toLowerCase().replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(
      { name, topic: topic.trim() || undefined, isPrivate },
      {
        onSuccess: (c) => {
          onClose();
          navigate(`/chat/${c._id}`);
        },
        onError: (err) => toast.error(errorMessage(err, "Couldn't create the channel")),
      },
    );
  };

  return (
    <Modal title="Create a channel" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor="ch-name">Name</label>
          <div className="relative">
            <Hash className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input id="ch-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus placeholder="design-team" className={`${inputClass} pl-9`} />
          </div>
          {slug && slug !== name && <p className="mt-1 text-[11px] text-zinc-500">Will be created as #{slug}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor="ch-topic">Topic (optional)</label>
          <input id="ch-topic" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={250} placeholder="What's this channel about?" className={inputClass} />
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/[0.06] p-3">
          <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="mt-0.5 accent-emerald-500" />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-200"><Lock className="h-3.5 w-3.5" /> Private</span>
            <span className="text-xs text-zinc-500">Only people you add can see or join it.</span>
          </span>
        </label>
        <button type="submit" disabled={!slug || create.isPending} className={primaryButton}>
          {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Create channel
        </button>
      </form>
    </Modal>
  );
}

/* ---------------- People picker (new DM / group, add to channel) ---------------- */

function PeoplePicker({
  selected,
  onToggle,
  exclude = [],
  max,
}: {
  selected: Person[];
  onToggle: (p: Person) => void;
  exclude?: string[];
  max?: number;
}) {
  const { data: members = [], isLoading } = useTeamMembers();
  const [q, setQ] = useState("");
  const list = useMemo(
    () =>
      members
        .filter((m) => !exclude.includes(m._id))
        .filter((m) => `${m.fullName} ${m.email}`.toLowerCase().includes(q.toLowerCase())),
    [members, q, exclude],
  );

  return (
    <div>
      <div className="relative mb-2">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" autoFocus className={`${inputClass} pl-9`} aria-label="Search people" />
      </div>
      <ul className="custom-scrollbar max-h-64 space-y-0.5 overflow-y-auto">
        {isLoading && <li className="py-6 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-zinc-500" /></li>}
        {!isLoading && list.length === 0 && <li className="py-6 text-center text-sm text-zinc-500">No one found.</li>}
        {list.map((m) => {
          const on = selected.some((s) => s._id === m._id);
          const disabled = !on && max !== undefined && selected.length >= max;
          return (
            <li key={m._id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onToggle(m)}
                aria-pressed={on}
                className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white/[0.04] disabled:opacity-40 ${on ? "bg-emerald-500/10" : ""}`}
              >
                <Avatar person={m} size="sm" showPresence />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-zinc-100">{m.fullName}</span>
                  <span className="block truncate text-xs text-zinc-500">{m.email}</span>
                </span>
                {on && <Check className="h-4 w-4 text-emerald-400" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const toggle = (list: Person[], p: Person) => (list.some((s) => s._id === p._id) ? list.filter((s) => s._id !== p._id) : [...list, p]);

export function NewMessageDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const open = useOpenDirect();
  const [selected, setSelected] = useState<Person[]>([]);

  const start = () =>
    open.mutate(
      selected.map((p) => p._id),
      {
        onSuccess: (c) => {
          onClose();
          navigate(`/chat/${c._id}`);
        },
        onError: (err) => toast.error(errorMessage(err, "Couldn't start the conversation")),
      },
    );

  return (
    <Modal title="New message" onClose={onClose}>
      <PeoplePicker selected={selected} onToggle={(p) => setSelected((s) => toggle(s, p))} max={7} />
      <button onClick={start} disabled={selected.length === 0 || open.isPending} className={`${primaryButton} mt-4`}>
        {open.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {selected.length > 1 ? `Start group with ${selected.length} people` : "Start conversation"}
      </button>
    </Modal>
  );
}

export function AddPeopleDialog({ conversationId, existing, onClose }: { conversationId: string; existing: string[]; onClose: () => void }) {
  const add = useAddMembers();
  const [selected, setSelected] = useState<Person[]>([]);
  return (
    <Modal title="Add people" onClose={onClose}>
      <PeoplePicker selected={selected} onToggle={(p) => setSelected((s) => toggle(s, p))} exclude={existing} />
      <button
        onClick={() =>
          add.mutate(
            { id: conversationId, userIds: selected.map((p) => p._id) },
            {
              onSuccess: () => {
                toast.success(`Added ${selected.length} ${selected.length === 1 ? "person" : "people"}`);
                onClose();
              },
              onError: (err) => toast.error(errorMessage(err, "Couldn't add people")),
            },
          )
        }
        disabled={selected.length === 0 || add.isPending}
        className={`${primaryButton} mt-4`}
      >
        {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Add
      </button>
    </Modal>
  );
}

/* ---------------- Browse channels ---------------- */

export function BrowseChannelsDialog({ onClose, onCreate }: { onClose: () => void; onCreate: () => void }) {
  const navigate = useNavigate();
  const { data: channels = [], isLoading } = useBrowseChannels();
  const join = useJoinChannel();

  return (
    <Modal title="Browse channels" onClose={onClose}>
      {isLoading ? (
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-zinc-500" />
      ) : channels.length === 0 ? (
        <p className="py-4 text-center text-sm text-zinc-500">You're in every public channel.</p>
      ) : (
        <ul className="custom-scrollbar max-h-80 space-y-1 overflow-y-auto">
          {channels.map((c) => (
            <li key={c._id} className="flex items-center gap-3 rounded-lg border border-white/[0.06] px-3 py-2">
              <Hash className="h-4 w-4 shrink-0 text-zinc-500" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-100">{c.name}</span>
                <span className="block truncate text-xs text-zinc-500">
                  {c.memberCount} {c.memberCount === 1 ? "member" : "members"}
                  {c.topic ? ` · ${c.topic}` : ""}
                </span>
              </span>
              <button
                onClick={() =>
                  join.mutate(c._id, {
                    onSuccess: () => {
                      onClose();
                      navigate(`/chat/${c._id}`);
                    },
                    onError: (err) => toast.error(errorMessage(err, "Couldn't join")),
                  })
                }
                disabled={join.isPending}
                className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-zinc-700"
              >
                Join
              </button>
            </li>
          ))}
        </ul>
      )}
      <button onClick={onCreate} className="mt-4 w-full rounded-lg border border-white/10 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
        Create a new channel
      </button>
    </Modal>
  );
}
