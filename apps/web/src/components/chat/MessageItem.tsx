import { memo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Edit, FileText, MessageSquare, Trash2 } from "@/components/icons";
import { useDeleteMessage, useEditMessage } from "@/api/chat";
import type { Message, Person } from "@/api/types";
import { errorMessage } from "@/lib/api";
import { Avatar } from "./Avatar";
import { fileSize, timeLabel } from "./format";

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;
const IS_URL = /^https?:\/\//;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Plain text with clickable links and highlighted @mentions. Never renders HTML. */
function RichText({ text, mentioned, myId }: { text: string; mentioned: Person[]; myId?: string }) {
  const mentionRe = mentioned.length
    ? new RegExp(`(@(?:${mentioned.map((p) => escapeRe(p.fullName)).join("|")}))`, "g")
    : null;

  const renderMentions = (chunk: string, keyBase: string): ReactNode[] => {
    if (!mentionRe) return [chunk];
    return chunk.split(mentionRe).map((part, i) => {
      const person = mentioned.find((p) => `@${p.fullName}` === part);
      if (!person) return part;
      return (
        <span
          key={`${keyBase}-${i}`}
          className={`rounded px-0.5 font-medium ${person._id === myId ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/10 text-emerald-400"}`}
        >
          {part}
        </span>
      );
    });
  };

  return (
    <>
      {text.split(URL_RE).map((part, i) =>
        IS_URL.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow" className="text-emerald-400 underline underline-offset-2 break-all">
            {part}
          </a>
        ) : (
          <span key={i}>{renderMentions(part, String(i))}</span>
        ),
      )}
    </>
  );
}

function Attachments({ message }: { message: Message }) {
  if (message.attachments.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {message.attachments.map((a, i) =>
        a.mimeType.startsWith("image/") && a.url ? (
          <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-white/10">
            <img src={a.url} alt={a.fileName} loading="lazy" className="max-h-64 max-w-[18rem] object-cover" />
          </a>
        ) : (
          <a
            key={i}
            href={a.url ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="flex max-w-xs items-center gap-2.5 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 hover:bg-zinc-800"
          >
            <FileText className="h-5 w-5 shrink-0 text-zinc-400" />
            <span className="min-w-0">
              <span className="block truncate text-sm text-zinc-200">{a.fileName}</span>
              <span className="text-xs text-zinc-500">{fileSize(a.size)}</span>
            </span>
          </a>
        ),
      )}
    </div>
  );
}

interface Props {
  message: Message;
  /** Same sender as the previous message, shortly after: no avatar/name. */
  compact: boolean;
  myId?: string;
  isAdmin: boolean;
  people: Map<string, Person>;
  /** Hidden inside the thread panel. */
  onOpenThread?: (rootId: string) => void;
}

function MessageItemInner({ message, compact, myId, isAdmin, people, onOpenThread }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.text);
  const edit = useEditMessage();
  const remove = useDeleteMessage();

  const mine = message.sender._id === myId;
  const mentionsMe = Boolean(myId && message.mentions.includes(myId));
  const mentioned = message.mentions.flatMap((id) => people.get(id) ?? []);

  const save = () => {
    const text = draft.trim();
    if (text === message.text) return setEditing(false);
    edit.mutate(
      { id: message._id, text },
      {
        onSuccess: () => setEditing(false),
        onError: (err) => toast.error(errorMessage(err, "Couldn't save the edit")),
      },
    );
  };

  const del = () => {
    if (!confirm("Delete this message? This can't be undone.")) return;
    remove.mutate(message._id, { onError: (err) => toast.error(errorMessage(err, "Couldn't delete the message")) });
  };

  return (
    <div
      id={`m-${message._id}`}
      className={`group relative flex gap-3 rounded-lg px-3 py-1 hover:bg-white/[0.03] ${compact ? "" : "mt-3"} ${
        mentionsMe ? "border-l-2 border-amber-500/60 bg-amber-500/[0.04]" : ""
      }`}
    >
      <div className="w-9 shrink-0">
        {compact ? (
          <span className="invisible block pt-1 text-right text-[10px] text-zinc-600 group-hover:visible">
            {timeLabel(message.createdAt)}
          </span>
        ) : (
          <Avatar person={message.sender} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        {!compact && (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-zinc-100">{message.sender.fullName}</span>
            <span className="text-[11px] text-zinc-500">{timeLabel(message.createdAt)}</span>
          </div>
        )}

        {message.deleted ? (
          <p className="text-sm italic text-zinc-500">This message was deleted.</p>
        ) : editing ? (
          <div className="mt-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  save();
                }
                if (e.key === "Escape") setEditing(false);
              }}
              autoFocus
              rows={Math.min(6, draft.split("\n").length + 1)}
              aria-label="Edit message"
              className="w-full resize-none rounded-lg border border-emerald-500/40 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none"
            />
            <p className="mt-1 text-[11px] text-zinc-500">Enter to save · Esc to cancel</p>
          </div>
        ) : (
          <>
            {message.text && (
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-300">
                <RichText text={message.text} mentioned={mentioned} myId={myId} />
                {message.editedAt && <span className="ml-1 text-[11px] text-zinc-500">(edited)</span>}
              </p>
            )}
            <Attachments message={message} />
          </>
        )}

        {onOpenThread && message.replyCount > 0 && !message.deleted && (
          <button
            onClick={() => onOpenThread(message._id)}
            className="mt-1 flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/10"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {message.replyCount} {message.replyCount === 1 ? "reply" : "replies"}
            {message.lastReplyAt && <span className="font-normal text-zinc-500">· last {timeLabel(message.lastReplyAt)}</span>}
          </button>
        )}
      </div>

      {/* Hover actions */}
      {!message.deleted && !editing && (
        <div className="absolute -top-3 right-3 hidden items-center gap-0.5 rounded-lg border border-white/10 bg-zinc-900 p-0.5 shadow-lg group-hover:flex group-focus-within:flex">
          {onOpenThread && (
            <button onClick={() => onOpenThread(message._id)} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white" title="Reply in thread" aria-label="Reply in thread">
              <MessageSquare className="h-3.5 w-3.5" />
            </button>
          )}
          {mine && (
            <button
              onClick={() => {
                setDraft(message.text);
                setEditing(true);
              }}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              title="Edit"
              aria-label="Edit message"
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
          )}
          {(mine || isAdmin) && (
            <button onClick={del} className="rounded-md p-1.5 text-zinc-400 hover:bg-red-500/10 hover:text-red-400" title="Delete" aria-label="Delete message">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export const MessageItem = memo(MessageItemInner);
