import { confirmDialog } from "@/components/ui/confirm";
import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { toast } from "sonner";
import { Check, Edit, Loader2, MessageSquare, Trash2 } from "@/components/icons";
import { Avatar } from "@/components/chat/Avatar";
import { useAddComment, useComments, useDeleteComment, useEditComment, useResolveComment } from "@/api/docs";
import type { DocCommentReply, DocCommentThread } from "@/api/types";
import { errorMessage } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { useAppSelector } from "@/store/hooks";
import { isAtLeast } from "@/store/slices/User";
import { removeCommentMark } from "./docEditor";

export interface CommentDraft {
  quote: string;
  /** Where the highlight goes once the comment is saved (kept in step with edits). */
  range: { from: number; to: number };
}

function Composer({
  placeholder,
  initial = "",
  busy,
  autoFocus,
  onSubmit,
  onCancel,
  submitLabel = "Comment",
}: {
  placeholder: string;
  initial?: string;
  busy: boolean;
  autoFocus?: boolean;
  onSubmit: (text: string) => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [text, setText] = useState(initial);
  const submit = () => text.trim() && onSubmit(text.trim());
  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") onCancel?.();
        }}
        autoFocus={autoFocus}
        rows={2}
        maxLength={5000}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full resize-none rounded-lg border border-white/10 bg-zinc-900 p-2 text-sm text-zinc-200 outline-none focus:border-emerald-500/40"
      />
      <div className="flex justify-end gap-1.5">
        {onCancel && (
          <button onClick={onCancel} className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800">
            Cancel
          </button>
        )}
        <button
          onClick={submit}
          disabled={!text.trim() || busy}
          className="flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          {busy && <Loader2 className="h-3 w-3 animate-spin" />} {submitLabel}
        </button>
      </div>
    </div>
  );
}

function CommentBody({ docId, c, canDelete, onDeleted }: { docId: string; c: DocCommentReply; canDelete: boolean; onDeleted?: () => void }) {
  const me = useAppSelector((s) => s.user.user);
  const edit = useEditComment(docId);
  const del = useDeleteComment(docId);
  const [editing, setEditing] = useState(false);
  const mine = c.author._id === me?._id;

  return (
    <div className="group">
      <div className="flex items-center gap-2">
        <Avatar person={c.author} size="xs" />
        <span className="text-xs font-semibold text-zinc-200">{c.author.fullName}</span>
        <span className="text-[11px] text-zinc-500">
          {formatRelativeTime(c.createdAt)}
          {c.editedAt ? " · edited" : ""}
        </span>
        <span className="ml-auto flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {mine && !editing && (
            <button onClick={() => setEditing(true)} className="rounded p-1 text-zinc-500 hover:text-white" aria-label="Edit comment">
              <Edit className="h-3 w-3" />
            </button>
          )}
          {(mine || canDelete) && (
            <button
              onClick={async () =>
                (await confirmDialog({ title: "Delete this comment?", action: "Delete", danger: true })) &&
                del.mutate(c._id, {
                  onSuccess: (r) => r.threadDeleted && onDeleted?.(),
                  onError: (err) => toast.error(errorMessage(err, "Couldn't delete")),
                })
              }
              className="rounded p-1 text-zinc-500 hover:text-red-400"
              aria-label="Delete comment"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </span>
      </div>
      {editing ? (
        <div className="mt-1.5">
          <Composer
            placeholder="Edit comment"
            initial={c.text}
            autoFocus
            busy={edit.isPending}
            submitLabel="Save"
            onCancel={() => setEditing(false)}
            onSubmit={(text) =>
              edit.mutate({ id: c._id, text }, { onSuccess: () => setEditing(false), onError: (err) => toast.error(errorMessage(err, "Couldn't save")) })
            }
          />
        </div>
      ) : (
        <p className="mt-1 whitespace-pre-wrap break-words pl-7 text-sm text-zinc-300">{c.text}</p>
      )}
    </div>
  );
}

function Thread({
  docId,
  t,
  active,
  onSelect,
  editor,
}: {
  docId: string;
  t: DocCommentThread;
  active: boolean;
  onSelect: () => void;
  editor: Editor | null;
}) {
  const isAdmin = isAtLeast(useAppSelector((s) => s.user.role), "admin");
  const add = useAddComment(docId);
  const resolve = useResolveComment(docId);
  const [replying, setReplying] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active]);

  return (
    <div
      ref={ref}
      onClick={onSelect}
      className={`space-y-3 rounded-xl border p-3 transition-colors ${
        active ? "border-amber-400/40 bg-amber-400/[0.04]" : "border-white/[0.06] hover:border-white/10"
      } ${t.resolvedAt ? "opacity-70" : ""}`}
    >
      {t.quote && <p className="line-clamp-2 border-l-2 border-amber-400/60 pl-2 text-xs italic text-zinc-400">{t.quote}</p>}
      <CommentBody docId={docId} c={t} canDelete={isAdmin} onDeleted={() => removeCommentMark(editor, t._id)} />
      {t.replies.map((r) => (
        <CommentBody key={r._id} docId={docId} c={r} canDelete={isAdmin} />
      ))}

      {replying ? (
        <Composer
          placeholder="Reply"
          autoFocus
          busy={add.isPending}
          onCancel={() => setReplying(false)}
          submitLabel="Reply"
          onSubmit={(text) =>
            add.mutate({ text, parentId: t._id }, { onSuccess: () => setReplying(false), onError: (err) => toast.error(errorMessage(err, "Couldn't reply")) })
          }
        />
      ) : (
        <div className="flex items-center gap-3 text-xs">
          <button onClick={() => setReplying(true)} className="text-zinc-400 hover:text-white">
            Reply
          </button>
          <button
            onClick={() =>
              resolve.mutate(
                { id: t._id, resolved: !t.resolvedAt },
                {
                  onSuccess: () => {
                    if (!t.resolvedAt) removeCommentMark(editor, t._id);
                  },
                  onError: (err) => toast.error(errorMessage(err, "Couldn't update")),
                },
              )
            }
            className="flex items-center gap-1 text-zinc-400 hover:text-emerald-400"
          >
            <Check className="h-3 w-3" /> {t.resolvedAt ? "Reopen" : "Resolve"}
          </button>
          {t.resolvedAt && t.resolvedBy && <span className="ml-auto text-[11px] text-zinc-500">Resolved by {t.resolvedBy.fullName}</span>}
        </div>
      )}
    </div>
  );
}

export function CommentsPanel({
  docId,
  editor,
  draft,
  onDraftDone,
  activeId,
  setActiveId,
}: {
  docId: string;
  editor: Editor | null;
  draft: CommentDraft | null;
  onDraftDone: () => void;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
}) {
  const { data: threads = [], isLoading } = useComments(docId);
  const add = useAddComment(docId);
  const [showResolved, setShowResolved] = useState(false);
  const open = threads.filter((t) => !t.resolvedAt);
  const resolved = threads.filter((t) => t.resolvedAt);
  // Opening a resolved thread from a link shows the resolved list.
  useEffect(() => {
    if (activeId && resolved.some((t) => t._id === activeId)) setShowResolved(true);
  }, [activeId, resolved]);

  const startThread = (text: string) => {
    if (!draft) return;
    add.mutate(
      { text, quote: draft.quote },
      {
        onSuccess: ({ _id }) => {
          const { from, to } = draft.range;
          if (editor && !editor.isDestroyed && to > from && to <= editor.state.doc.content.size) {
            editor.chain().setTextSelection({ from, to }).setMark("comment", { commentId: _id }).setTextSelection(to).run();
          }
          setActiveId(_id);
          onDraftDone();
        },
        onError: (err) => toast.error(errorMessage(err, "Couldn't add the comment")),
      },
    );
  };

  return (
    <div className="space-y-3 p-3">
      {draft && (
        <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-3">
          <p className="line-clamp-3 border-l-2 border-amber-400/60 pl-2 text-xs italic text-zinc-400">{draft.quote}</p>
          <Composer placeholder="Add a comment" autoFocus busy={add.isPending} onSubmit={startThread} onCancel={onDraftDone} />
        </div>
      )}

      {isLoading ? (
        <Loader2 className="mx-auto mt-6 h-5 w-5 animate-spin text-zinc-600" />
      ) : open.length === 0 && !draft ? (
        <div className="px-2 py-8 text-center text-sm text-zinc-500">
          <MessageSquare className="mx-auto mb-2 h-6 w-6 text-zinc-600" />
          Select some text and press <span className="font-medium text-zinc-300">Comment</span> to start a discussion.
        </div>
      ) : (
        open.map((t) => <Thread key={t._id} docId={docId} t={t} editor={editor} active={activeId === t._id} onSelect={() => setActiveId(t._id)} />)
      )}

      {resolved.length > 0 && (
        <div className="pt-2">
          <button onClick={() => setShowResolved((v) => !v)} className="text-xs text-zinc-500 hover:text-zinc-300">
            {showResolved ? "Hide" : "Show"} {resolved.length} resolved
          </button>
          {showResolved && (
            <div className="mt-3 space-y-3">
              {resolved.map((t) => (
                <Thread key={t._id} docId={docId} t={t} editor={editor} active={activeId === t._id} onSelect={() => setActiveId(t._id)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
