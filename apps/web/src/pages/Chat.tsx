import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, DoorExit, Edit, Hash, Loader2, Lock, MessageSquare, Plus, Search, Sparkles, UserPlus, Users } from "@/components/icons";
import { useCatchUp } from "@/api/ai";
import { Modal } from "@/components/chat/Dialogs";
import {
  useConversationMembers,
  useConversations,
  useLeaveConversation,
  useMarkRead,
  useUpdateConversation,
} from "@/api/chat";
import { setActiveConversation } from "@/api/realtime";
import type { Conversation, Person } from "@/api/types";
import { errorMessage } from "@/lib/api";
import { useAppSelector } from "@/store/hooks";
import { isAtLeast } from "@/store/slices/User";
import { Avatar } from "@/components/chat/Avatar";
import { Composer } from "@/components/chat/Composer";
import { AddPeopleDialog, BrowseChannelsDialog, NewChannelDialog, NewMessageDialog } from "@/components/chat/Dialogs";
import { MessageList } from "@/components/chat/MessageList";
import { ThreadPanel } from "@/components/chat/ThreadPanel";
import { conversationTitle } from "@/components/chat/format";

type DialogName = "channel" | "browse" | "message" | "add" | null;

/* ================= Sidebar ================= */

function Badge({ c }: { c: Conversation }) {
  if (c.mentionCount > 0)
    return <span className="ml-auto rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">{c.mentionCount}</span>;
  if (c.unreadCount > 0)
    return (
      <span className="ml-auto rounded-full bg-zinc-700 px-1.5 text-[11px] font-semibold text-zinc-100">
        {c.unreadCount >= 100 ? "99+" : c.unreadCount}
      </span>
    );
  return null;
}

function ConversationRow({ c, active }: { c: Conversation; active: boolean }) {
  const unread = c.unreadCount > 0 || c.mentionCount > 0;
  return (
    <Link
      to={`/chat/${c._id}`}
      className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
        active ? "bg-emerald-500/10 text-emerald-400" : unread ? "font-semibold text-zinc-100 hover:bg-white/[0.04]" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
      }`}
    >
      {c.type === "channel" ? (
        c.isPrivate ? <Lock className="h-4 w-4 shrink-0 opacity-70" /> : <Hash className="h-4 w-4 shrink-0 opacity-70" />
      ) : c.type === "dm" && c.members[0] ? (
        <Avatar person={c.members[0]} size="xs" showPresence />
      ) : (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-800 text-[10px] font-semibold text-zinc-300">
          {c.memberCount}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{c.type === "channel" ? c.name : conversationTitle(c)}</span>
      <Badge c={c} />
    </Link>
  );
}

function Sidebar({ conversations, activeId, open }: { conversations: Conversation[]; activeId?: string; open: (d: DialogName) => void }) {
  const [q, setQ] = useState("");
  const match = (c: Conversation) => conversationTitle(c).toLowerCase().includes(q.toLowerCase());
  const channels = conversations.filter((c) => c.type === "channel" && match(c));
  const direct = conversations.filter((c) => c.type !== "channel" && match(c));

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-white/[0.06] px-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-zinc-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a conversation"
            aria-label="Find a conversation"
            className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/60 py-1.5 pl-8 pr-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500/40"
          />
        </div>
        <button onClick={() => open("message")} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white" title="New message" aria-label="New message">
          <Edit className="h-4 w-4" />
        </button>
      </div>

      <nav className="custom-scrollbar flex-1 space-y-5 overflow-y-auto p-2">
        <section>
          <div className="mb-1 flex items-center justify-between px-2.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Channels</h3>
            <button onClick={() => open("browse")} className="rounded p-0.5 text-zinc-500 hover:text-white" title="Browse or create channels" aria-label="Browse or create channels">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {channels.map((c) => <ConversationRow key={c._id} c={c} active={c._id === activeId} />)}
        </section>
        <section>
          <div className="mb-1 flex items-center justify-between px-2.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Direct messages</h3>
            <button onClick={() => open("message")} className="rounded p-0.5 text-zinc-500 hover:text-white" title="New message" aria-label="New direct message">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {direct.length === 0 && !q && (
            <button onClick={() => open("message")} className="w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-zinc-500 hover:bg-white/[0.04]">
              Message a teammate…
            </button>
          )}
          {direct.map((c) => <ConversationRow key={c._id} c={c} active={c._id === activeId} />)}
        </section>
      </nav>
    </div>
  );
}

/* ================= Header ================= */

function Header({ c, onAddPeople }: { c: Conversation; onAddPeople: () => void }) {
  const navigate = useNavigate();
  const leave = useLeaveConversation();
  const update = useUpdateConversation();
  const [editingTopic, setEditingTopic] = useState(false);
  const [topic, setTopic] = useState(c.topic ?? "");
  const dmPartner = c.type === "dm" ? c.members[0] : undefined;
  const catchUp = useCatchUp();
  const [showCatchUp, setShowCatchUp] = useState(false);

  const saveTopic = () =>
    update.mutate(
      { id: c._id, topic: topic.trim() },
      {
        onSuccess: () => setEditingTopic(false),
        onError: (err) => toast.error(errorMessage(err, "Couldn't update the topic")),
      },
    );

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] px-3 md:px-5">
      <Link to="/chat?list=1" className="-ml-1 rounded-md p-1.5 text-zinc-400 hover:text-white md:hidden" aria-label="Back to conversations">
        <ArrowLeft className="h-5 w-5" />
      </Link>
      {dmPartner ? <Avatar person={dmPartner} size="sm" showPresence /> : c.type === "group" ? <Users className="h-5 w-5 text-zinc-500" /> : c.isPrivate ? <Lock className="h-5 w-5 text-zinc-500" /> : <Hash className="h-5 w-5 text-zinc-500" />}

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold text-zinc-100">{c.type === "channel" ? c.name : conversationTitle(c)}</h1>
        {editingTopic ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveTopic();
            }}
          >
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onBlur={saveTopic}
              onKeyDown={(e) => e.key === "Escape" && setEditingTopic(false)}
              maxLength={250}
              autoFocus
              aria-label="Channel topic"
              className="w-full max-w-md bg-transparent text-xs text-zinc-300 outline-none"
            />
          </form>
        ) : (
          <button
            onClick={() => c.type === "channel" && setEditingTopic(true)}
            className="block max-w-full truncate text-left text-xs text-zinc-500 hover:text-zinc-300"
            disabled={c.type !== "channel"}
          >
            {c.type === "channel"
              ? c.topic || `${c.memberCount} members · add a topic`
              : dmPartner
                ? "Direct message"
                : `${c.memberCount} people`}
          </button>
        )}
      </div>

      <button
        onClick={() => {
          setShowCatchUp(true);
          catchUp.mutate({ conversationId: c._id });
        }}
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white"
        title="Summarise the last 24 hours"
      >
        <Sparkles className="h-4 w-4" /> <span className="hidden sm:inline">Catch up</span>
      </button>
      {showCatchUp && (
        <Modal title={`Catch up on ${c.type === "channel" ? `#${c.name}` : conversationTitle(c)}`} onClose={() => setShowCatchUp(false)}>
          {catchUp.isPending ? (
            <p className="flex items-center gap-2 text-sm text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /> Reading the last 24 hours…</p>
          ) : catchUp.isError ? (
            <p className="text-sm text-red-400">{errorMessage(catchUp.error, "Couldn't summarise right now.")}</p>
          ) : catchUp.data?.summary ? (
            <>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">{catchUp.data.summary}</p>
              <p className="mt-3 text-xs text-zinc-500">From {catchUp.data.count} messages in the last 24 hours. AI summaries can miss things.</p>
            </>
          ) : (
            <p className="text-sm text-zinc-400">Nothing new in the last 24 hours.</p>
          )}
        </Modal>
      )}
      {c.type === "channel" && (
        <>
          <span className="hidden items-center gap-1 text-xs text-zinc-500 sm:flex">
            <Users className="h-3.5 w-3.5" /> {c.memberCount}
          </span>
          <button onClick={onAddPeople} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white" title="Add people" aria-label="Add people">
            <UserPlus className="h-4 w-4" />
          </button>
          {!c.isDefault && (
            <button
              onClick={() => {
                if (!confirm(`Leave #${c.name}?${c.isPrivate ? " You'll need to be added again to come back." : ""}`)) return;
                leave.mutate(c._id, {
                  onSuccess: () => navigate("/chat"),
                  onError: (err) => toast.error(errorMessage(err, "Couldn't leave")),
                });
              }}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-red-500/10 hover:text-red-400"
              title="Leave channel"
              aria-label="Leave channel"
            >
              <DoorExit className="h-4 w-4" />
            </button>
          )}
        </>
      )}
    </header>
  );
}

/* ================= Page ================= */

export default function Chat() {
  const { conversationId } = useParams();
  const [params, setParams] = useSearchParams();
  const threadId = params.get("thread");
  const myId = useAppSelector((s) => s.user.user?._id);
  const isAdmin = isAtLeast(useAppSelector((s) => s.user.role), "admin");
  const { data: conversations = [], isLoading } = useConversations();
  const { data: members = [] } = useConversationMembers(conversationId);
  const markRead = useMarkRead();
  const [dialog, setDialog] = useState<DialogName>(null);

  const active = conversations.find((c) => c._id === conversationId);

  // Remember how many were unread when this conversation opened (for the "New" line).
  const unreadAtOpen = useRef<Record<string, number>>({});
  if (active && unreadAtOpen.current[active._id] === undefined) unreadAtOpen.current[active._id] = active.unreadCount;

  // Reading: on open, and whenever new messages arrive while it's open.
  useEffect(() => {
    setActiveConversation(conversationId ?? null);
    return () => setActiveConversation(null);
  }, [conversationId]);

  useEffect(() => {
    if (active && (active.unreadCount > 0 || active.mentionCount > 0) && !document.hidden) markRead.mutate(active._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?._id, active?.unreadCount, active?.mentionCount]);

  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && active && active.unreadCount > 0) markRead.mutate(active._id);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  });

  const people = useMemo(() => new Map<string, Person>(members.map((m) => [m._id, m])), [members]);
  const mentionable = useMemo(() => members.filter((m) => m._id !== myId), [members, myId]);

  const openThread = (rootId: string) => setParams({ thread: rootId });
  const closeThread = () => setParams({});

  // /chat with no conversation: open #general on desktop, show the list on phones.
  if (!conversationId && !isLoading) {
    const general = conversations.find((c) => c.isDefault);
    const wantsList = params.has("list") || window.matchMedia("(max-width: 767px)").matches;
    if (general && !wantsList) return <Navigate to={`/chat/${general._id}`} replace />;
  }

  const showListOnMobile = !conversationId;

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-zinc-950 text-zinc-100 md:h-[calc(100dvh-0px)]">
      <aside className={`w-full shrink-0 border-r border-white/[0.06] bg-zinc-900/30 md:block md:w-72 ${showListOnMobile ? "block" : "hidden"}`}>
        {isLoading ? (
          <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-zinc-600" /></div>
        ) : (
          <Sidebar conversations={conversations} activeId={conversationId} open={setDialog} />
        )}
      </aside>

      <main className={`min-w-0 flex-1 flex-col ${showListOnMobile ? "hidden md:flex" : "flex"}`}>
        {!conversationId ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-500">
            <MessageSquare className="h-10 w-10 opacity-30" />
            <p className="text-sm">Pick a conversation</p>
          </div>
        ) : !active ? (
          isLoading ? (
            <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-zinc-600" /></div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-500">
              <p className="text-sm">This conversation doesn't exist or you're not in it.</p>
              <Link to="/chat" className="text-sm text-emerald-400">Back to chat</Link>
            </div>
          )
        ) : (
          <>
            <Header c={active} onAddPeople={() => setDialog("add")} />
            <MessageList
              conversationId={active._id}
              myId={myId}
              isAdmin={isAdmin}
              people={people}
              unreadAtOpen={unreadAtOpen.current[active._id] ?? 0}
              onOpenThread={openThread}
              emptyState={
                <div className="pb-4">
                  <p className="text-lg font-semibold text-zinc-100">
                    {active.type === "channel" ? `Welcome to #${active.name}` : `This is the start of your conversation with ${conversationTitle(active)}`}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {active.type === "channel" ? active.topic || "Say hello to get things going." : "Messages here are only visible to the people in it."}
                  </p>
                </div>
              }
            />
            <div className="shrink-0 px-3 pb-3 md:px-5">
              <Composer
                conversationId={active._id}
                placeholder={`Message ${active.type === "channel" ? `#${active.name}` : conversationTitle(active)}`}
                people={mentionable}
                autoFocus
              />
            </div>
          </>
        )}
      </main>

      {active && threadId && (
        <ThreadPanel
          conversationId={active._id}
          rootId={threadId}
          title={active.type === "channel" ? `#${active.name}` : conversationTitle(active)}
          myId={myId}
          isAdmin={isAdmin}
          people={people}
          mentionable={mentionable}
          onClose={closeThread}
        />
      )}

      {dialog === "channel" && <NewChannelDialog onClose={() => setDialog(null)} />}
      {dialog === "browse" && <BrowseChannelsDialog onClose={() => setDialog(null)} onCreate={() => setDialog("channel")} />}
      {dialog === "message" && <NewMessageDialog onClose={() => setDialog(null)} />}
      {dialog === "add" && active && (
        <AddPeopleDialog conversationId={active._id} existing={members.map((m) => m._id)} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
