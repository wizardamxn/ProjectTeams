import { Tip } from "@/components/ui/tooltip";
import { confirmDialog } from "@/components/ui/confirm";
import { Select } from "@/components/ui/select";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Clock,
  Loader2,
  MessageSquare,
  Sparkles,
  Star,
  Tag as TagIcon,
  Trash2,
  Wand2,
  X,
} from "@/components/icons";
import { commentsKey, useComments, useDeleteDoc, useDoc, useFolders, useRestoreVersion, useToggleStar, useUpdateDoc, useVersion, useVersions } from "@/api/docs";
import { useGenerateTags, useImproveWriting, useSummarize } from "@/api/ai";
import { errorMessage } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { useAppSelector } from "@/store/hooks";
import { isAtLeast } from "@/store/slices/User";
import { RichEditorContent, RichPreview, Toolbar } from "@/components/docs/RichEditor";
import { useLiveDocEditor, type Collaborator } from "@/components/docs/docEditor";
import { CommentsPanel, type CommentDraft } from "@/components/docs/CommentsPanel";
import socket from "@/utils/socket";

// The body is edited live (shared with everyone who has the doc open) and
// saved by the server. This page only autosaves the details: title, folder,
// summary and tags.
const AUTOSAVE_MS = 1500;
type SaveState = "saved" | "dirty" | "saving" | "error";
type Panel = "details" | "history" | "comments" | null;

export default function Editor() {
  const { doc_id } = useParams();
  const { data: doc, isLoading, error } = useDoc(doc_id);
  const navigate = useNavigate();

  useEffect(() => {
    if (error) {
      toast.error(errorMessage(error, "Couldn't open this document"));
      navigate("/documents", { replace: true });
    }
  }, [error, navigate]);

  if (isLoading || !doc || !doc.contentJson) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }
  // key: a fresh editor per doc
  return <DocEditor key={doc._id} docId={doc._id} />;
}

function DocEditor({ docId }: { docId: string }) {
  const navigate = useNavigate();
  const { data: doc } = useDoc(docId);
  const me = useAppSelector((s) => s.user.user);
  const isAdmin = isAtLeast(useAppSelector((s) => s.user.role), "admin");
  const { data: folders = [] } = useFolders();
  // `mutate` is stable across renders; the mutation object itself is not.
  const { mutate: saveDoc } = useUpdateDoc();
  const star = useToggleStar();
  const del = useDeleteDoc();

  const [title, setTitle] = useState(doc!.title);
  const [summary, setSummary] = useState(doc!.summary);
  const [tags, setTags] = useState<string[]>(doc!.tags);
  const [tagInput, setTagInput] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [savedAt, setSavedAt] = useState(new Date(doc!.updatedAt));
  const [params, setParams] = useSearchParams();
  const linkedComment = params.get("comment");
  const [panel, setPanel] = useState<Panel>(() => (linkedComment ? "comments" : window.innerWidth >= 1280 ? "details" : null));
  const [activeComment, setActiveComment] = useState<string | null>(linkedComment);
  const [draft, setDraft] = useState<CommentDraft | null>(null);
  const qc = useQueryClient();

  // Pending detail changes are collected here and sent together.
  const pending = useRef<Partial<{ title: string; summary: string; tags: string[]; folderId: string | null }>>({});
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    const input = pending.current;
    if (Object.keys(input).length === 0) return;
    if (input.title !== undefined && !input.title.trim()) input.title = "Untitled";
    pending.current = {};
    setSaveState("saving");
    saveDoc(
      { id: docId, input },
      {
        onSuccess: (saved) => {
          setSavedAt(new Date(saved.updatedAt));
          setSaveState(Object.keys(pending.current).length ? "dirty" : "saved");
        },
        onError: (err) => {
          pending.current = { ...input, ...pending.current }; // retry these next time
          setSaveState("error");
          toast.error(errorMessage(err, "Couldn't save. We'll keep trying."), { id: "doc-save" });
        },
      },
    );
  }, [docId, saveDoc]);

  const queue = useCallback(
    (patch: typeof pending.current) => {
      pending.current = { ...pending.current, ...patch };
      setSaveState("dirty");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, AUTOSAVE_MS);
    },
    [flush],
  );

  // Save on leave, and warn if the browser is closing with unsaved changes.
  // Runs once: the cleanup must only fire on unmount, never on re-render.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length) {
        flushRef.current();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      flushRef.current();
    };
  }, []);

  // Retry after an error.
  useEffect(() => {
    if (saveState !== "error") return;
    const t = window.setTimeout(flush, 5000);
    return () => window.clearTimeout(t);
  }, [saveState, flush]);

  const { editor, status: liveStatus, people, loaded } = useLiveDocEditor({ docId, user: { _id: me?._id ?? "", fullName: me?.fullName ?? "Someone" } });

  // Server events for this doc: body saved, comments changed, doc deleted.
  useEffect(() => {
    const onSaved = ({ docId: id, updatedAt }: { docId: string; updatedAt: string }) => id === docId && setSavedAt(new Date(updatedAt));
    const onComments = ({ docId: id }: { docId: string }) => id === docId && qc.invalidateQueries({ queryKey: commentsKey(docId) });
    const onDeleted = ({ docId: id }: { docId: string }) => {
      if (id !== docId) return;
      pending.current = {};
      toast("This document was deleted");
      navigate("/documents", { replace: true });
    };
    socket.on("doc:saved", onSaved);
    socket.on("doc:comments", onComments);
    socket.on("doc:deleted", onDeleted);
    return () => {
      socket.off("doc:saved", onSaved);
      socket.off("doc:comments", onComments);
      socket.off("doc:deleted", onDeleted);
    };
  }, [docId, qc, navigate]);

  /* ---- Comments ---- */
  const { data: threads = [] } = useComments(docId);
  const openThreads = threads.filter((t) => !t.resolvedAt).length;
  // Keep a new comment's target range in step with edits (yours and others') until it's saved.
  const draftRef = useRef<CommentDraft | null>(null);
  draftRef.current = draft;
  useEffect(() => {
    if (!editor) return;
    const onTr = ({ transaction }: { transaction: { docChanged: boolean; mapping: { map: (pos: number, assoc?: number) => number } } }) => {
      const d = draftRef.current;
      if (!d || !transaction.docChanged) return;
      setDraft({ ...d, range: { from: transaction.mapping.map(d.range.from, 1), to: transaction.mapping.map(d.range.to, -1) } });
    };
    editor.on("transaction", onTr);
    return () => void editor.off("transaction", onTr);
  }, [editor]);
  // Clicking highlighted text opens its thread.
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest?.("[data-comment-id]");
      const id = el?.getAttribute("data-comment-id");
      if (!id) return;
      setActiveComment(id);
      setPanel("comments");
    };
    dom.addEventListener("click", onClick);
    return () => dom.removeEventListener("click", onClick);
  }, [editor]);
  const startComment = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const quote = editor.state.doc.textBetween(from, to, " ").trim();
    if (!quote) return toast("Select the text you want to comment on");
    setDraft({ quote: quote.slice(0, 500), range: { from, to } });
    setPanel("comments");
  };
  const selectComment = (id: string | null) => {
    setActiveComment(id);
    if (linkedComment) setParams({}, { replace: true });
  };

  /* ---- AI helpers ---- */
  const summarize = useSummarize();
  const genTags = useGenerateTags();
  const improve = useImproveWriting();
  const plainText = () => editor?.getText() ?? "";

  const onSummarize = () => {
    if (!plainText().trim()) return toast.error("Write something first");
    summarize.mutate(plainText(), {
      onSuccess: (s) => {
        setSummary(s);
        queue({ summary: s });
      },
      onError: (err) => toast.error(errorMessage(err, "Couldn't summarize")),
    });
  };
  const onTags = () => {
    if (!plainText().trim()) return toast.error("Write something first");
    genTags.mutate(plainText(), {
      onSuccess: (t) => {
        const next = [...new Set([...tags, ...t])].slice(0, 20);
        setTags(next);
        queue({ tags: next });
      },
      onError: (err) => toast.error(errorMessage(err, "Couldn't suggest tags")),
    });
  };
  const onImprove = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selected = editor.state.doc.textBetween(from, to, "\n");
    if (!selected.trim()) return toast.error("Select the text you want to improve");
    improve.mutate(selected, {
      onSuccess: (text) => editor.chain().focus().insertContentAt({ from, to }, text).run(),
      onError: (err) => toast.error(errorMessage(err, "Couldn't improve that")),
    });
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || tags.includes(t)) return setTagInput("");
    const next = [...tags, t];
    setTags(next);
    setTagInput("");
    queue({ tags: next });
  };
  const removeTag = (t: string) => {
    const next = tags.filter((x) => x !== t);
    setTags(next);
    queue({ tags: next });
  };

  const onDelete = async () => {
    if (!(await confirmDialog({ title: `Delete "${title}"?`, body: "This can't be undone.", action: "Delete", danger: true }))) return;
    pending.current = {};
    del.mutate(docId, {
      onSuccess: () => navigate("/documents", { replace: true }),
      onError: (err) => toast.error(errorMessage(err, "Couldn't delete")),
    });
  };

  const canDelete = doc!.createdBy === me?._id || isAdmin;
  const savedLabel = `Saved ${formatRelativeTime(savedAt) === "Today" ? savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : formatRelativeTime(savedAt)}`;
  const statusText =
    liveStatus === "offline" ? "Offline: your edits will sync when you're back"
    : liveStatus === "error" ? "Couldn't connect to this doc"
    : !loaded ? "Connecting…"
    : saveState === "saving" ? "Saving…" : saveState === "dirty" ? "Unsaved changes" : saveState === "error" ? "Not saved, retrying" : savedLabel;
  const statusWarn = liveStatus === "offline" || liveStatus === "error" || saveState === "error";

  return (
    <div className="-m-4 flex min-h-[100dvh] md:-m-8">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <div className="sticky top-0 z-20 border-b border-white/[0.06] bg-zinc-950/90 backdrop-blur">
          <div className="flex h-12 items-center gap-2 px-3 md:px-6">
            <button onClick={() => navigate("/documents")} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label="Back to documents">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <Select
              value={doc!.folderId ?? ""}
              onChange={(v) => queue({ folderId: v || null })}
              options={[{ value: "", label: "No folder" }, ...folders.map((f) => ({ value: f._id, label: f.name }))]}
              aria-label="Folder"
              className="h-7 max-w-[10rem] border-transparent bg-transparent px-1.5 text-xs text-zinc-400 hover:border-white/10"
            />

            <span className={`ml-auto flex min-w-0 items-center gap-1.5 truncate text-xs ${statusWarn ? "text-amber-400" : "text-zinc-500"}`} aria-live="polite">
              {!loaded || saveState === "saving" ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : statusWarn ? <AlertCircle className="h-3.5 w-3.5 shrink-0" /> : saveState === "saved" ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
              <span className="truncate">{statusText}</span>
            </span>
            <Presence people={people} />
            <Tip label="Comments"><button
              onClick={() => setPanel((p) => (p === "comments" ? null : "comments"))}
              className={`relative rounded-md p-1.5 hover:bg-zinc-800 ${panel === "comments" ? "text-emerald-400" : "text-zinc-400 hover:text-white"}`}
              aria-label={`Comments${openThreads ? ` (${openThreads} open)` : ""}`}
            >
              <MessageSquare className="h-4 w-4" />
              {openThreads > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[9px] font-bold text-zinc-950">
                  {openThreads}
                </span>
              )}
            </button></Tip>
            <Tip label={doc!.starred ? "Starred (only you see your stars)" : "Star"}><button
              onClick={() => star.mutate(docId)}
              className={`rounded-md p-1.5 hover:bg-zinc-800 ${doc!.starred ? "text-amber-400" : "text-zinc-400 hover:text-white"}`}
              aria-label={doc!.starred ? "Unstar" : "Star"}
              aria-pressed={doc!.starred}
            >
              <Star className={`h-4 w-4 ${doc!.starred ? "fill-current" : ""}`} />
            </button></Tip>
            <Tip label="Version history"><button
              onClick={() => setPanel((p) => (p === "history" ? null : "history"))}
              className={`rounded-md p-1.5 hover:bg-zinc-800 ${panel === "history" ? "text-emerald-400" : "text-zinc-400 hover:text-white"}`}
              aria-label="Version history"
            >
              <Clock className="h-4 w-4" />
            </button></Tip>
            <Tip label="Details and AI tools"><button
              onClick={() => setPanel((p) => (p === "details" ? null : "details"))}
              className={`rounded-md p-1.5 hover:bg-zinc-800 ${panel === "details" ? "text-emerald-400" : "text-zinc-400 hover:text-white"}`}
              aria-label="Details and AI tools"
            >
              <Sparkles className="h-4 w-4" />
            </button></Tip>
          </div>
          {editor && (
            <div className="flex items-center gap-1 border-t border-white/[0.04] px-3 py-1 md:px-6">
              <Toolbar editor={editor} />
              <Tip label="Comment on the selected text"><button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={startComment}
                disabled={!loaded}
                className="ml-auto flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30"
              >
                <MessageSquare className="h-3.5 w-3.5" /> Comment
              </button></Tip>
            </div>
          )}
        </div>

        {/* Page */}
        <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 md:px-10">
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              queue({ title: e.target.value });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                editor?.commands.focus("start");
              }
            }}
            maxLength={200}
            placeholder="Untitled"
            aria-label="Title"
            className="mb-6 w-full bg-transparent text-4xl font-bold tracking-tight text-zinc-100 outline-none placeholder:text-zinc-700"
          />
          {!loaded && liveStatus !== "error" ? (
            <div className="space-y-3" aria-hidden>
              {[90, 75, 82, 40].map((w) => (
                <div key={w} className="h-4 animate-pulse rounded bg-zinc-800/70" style={{ width: `${w}%` }} />
              ))}
            </div>
          ) : (
            <RichEditorContent editor={editor} />
          )}
          {activeComment && <style>{`.doc-comment[data-comment-id="${CSS.escape(activeComment)}"]{background:rgb(245 158 11 / 0.35)}`}</style>}
        </div>
      </div>

      {/* Side panel */}
      {panel && (
        <aside className="fixed inset-y-0 right-0 z-30 w-full max-w-sm overflow-y-auto border-l border-white/[0.06] bg-zinc-950 xl:sticky xl:top-0 xl:h-[100dvh] xl:w-80">
          <div className="flex h-12 items-center justify-between border-b border-white/[0.06] px-4">
            <h2 className="text-sm font-semibold text-zinc-100">{panel === "details" ? "Details" : panel === "comments" ? "Comments" : "Version history"}</h2>
            <button onClick={() => setPanel(null)} className="rounded-md p-1 text-zinc-500 hover:text-white" aria-label="Close panel">
              <X className="h-4 w-4" />
            </button>
          </div>

          {panel === "details" ? (
            <div className="space-y-6 p-4">
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">AI</h3>
                <div className="space-y-1.5">
                  <AiButton icon={<Wand2 className="h-4 w-4" />} label="Improve selected text" busy={improve.isPending} onClick={onImprove} />
                  <AiButton icon={<Sparkles className="h-4 w-4" />} label="Write a summary" busy={summarize.isPending} onClick={onSummarize} />
                  <AiButton icon={<TagIcon className="h-4 w-4" />} label="Suggest tags" busy={genTags.isPending} onClick={onTags} />
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Summary</h3>
                <textarea
                  value={summary}
                  onChange={(e) => {
                    setSummary(e.target.value);
                    queue({ summary: e.target.value });
                  }}
                  rows={4}
                  maxLength={2000}
                  placeholder="A line or two people see in lists"
                  aria-label="Summary"
                  className="w-full resize-none rounded-lg border border-white/10 bg-zinc-900 p-2.5 text-sm text-zinc-200 outline-none focus:border-emerald-500/40"
                />
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Tags</h3>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span key={t} className="flex items-center gap-1 rounded-full bg-zinc-800 py-0.5 pl-2.5 pr-1 text-xs text-zinc-300">
                      {t}
                      <button onClick={() => removeTag(t)} className="rounded-full p-0.5 text-zinc-500 hover:text-white" aria-label={`Remove tag ${t}`}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Add a tag and press Enter"
                  aria-label="Add tag"
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-200 outline-none focus:border-emerald-500/40"
                />
              </section>

              <section className="space-y-1 text-xs text-zinc-500">
                <p>Created by {doc!.author.name} · {new Date(doc!.createdAt).toLocaleDateString()}</p>
                <p>Everyone with this doc open edits it together; changes save on their own.</p>
                <p>Ask in Knowledge can answer from this doc a minute after you stop typing.</p>
              </section>

              {canDelete && (
                <button onClick={onDelete} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-400">
                  <Trash2 className="h-3.5 w-3.5" /> Delete document
                </button>
              )}
            </div>
          ) : panel === "comments" ? (
            <CommentsPanel
              docId={docId}
              editor={editor}
              draft={draft}
              onDraftDone={() => setDraft(null)}
              activeId={activeComment}
              setActiveId={selectComment}
            />
          ) : (
            // The restored text arrives through live editing, for everyone at once.
            <History docId={docId} onRestored={(t) => {
              delete pending.current.title;
              setTitle(t);
            }} />
          )}
        </aside>
      )}
    </div>
  );
}

function AiButton({ icon, label, busy, onClick }: { icon: React.ReactNode; label: string; busy: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="flex w-full items-center gap-2.5 rounded-lg border border-white/[0.06] bg-zinc-900 px-3 py-2 text-left text-sm text-zinc-200 hover:border-white/10 hover:bg-zinc-800 disabled:opacity-60"
    >
      <span className="text-emerald-400">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}</span>
      {label}
    </button>
  );
}

/** Avatars of the other people in this doc right now. */
function Presence({ people }: { people: Collaborator[] }) {
  if (people.length === 0) return null;
  const shown = people.slice(0, 4);
  return (
    <div className="flex -space-x-1.5" aria-label={`Also here: ${people.map((p) => p.name).join(", ")}`}>
      {shown.map((p) => (
        <Tip key={p.clientId} label={`${p.name} is here`}><span
          className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-zinc-950"
          style={{ backgroundColor: p.color }}
        >
          {p.name.charAt(0).toUpperCase()}
        </span></Tip>
      ))}
      {people.length > shown.length && (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-700 text-[10px] text-zinc-200 ring-2 ring-zinc-950">
          +{people.length - shown.length}
        </span>
      )}
    </div>
  );
}

function History({ docId, onRestored }: { docId: string; onRestored: (title: string) => void }) {
  const { data: versions = [], isLoading } = useVersions(docId);
  const [selected, setSelected] = useState<string | null>(null);
  const { data: version } = useVersion(docId, selected);
  const restore = useRestoreVersion();

  if (isLoading) return <Loader2 className="m-6 h-5 w-5 animate-spin text-zinc-500" />;
  if (versions.length === 0) return <p className="p-4 text-sm text-zinc-500">No earlier versions yet. Snapshots are kept as the doc changes.</p>;

  return (
    <div className="p-2">
      <ul className="space-y-1">
        {versions.map((v) => (
          <li key={v._id}>
            <button
              onClick={() => setSelected(selected === v._id ? null : v._id)}
              className={`w-full rounded-lg px-3 py-2 text-left hover:bg-white/[0.04] ${selected === v._id ? "bg-emerald-500/10" : ""}`}
            >
              <span className="block text-sm text-zinc-200">
                {new Date(v.savedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
              <span className="block text-xs text-zinc-500">{v.editedBy?.fullName ?? "Unknown"} · {v.preview.slice(0, 60) || "Empty"}</span>
            </button>
            {selected === v._id && version && (
              <div className="mx-1 mb-2 rounded-lg border border-white/[0.06] p-3">
                <p className="mb-2 text-sm font-semibold text-zinc-100">{version.title}</p>
                <div className="max-h-72 overflow-y-auto text-sm [&_.rich-text]:min-h-0 [&_.rich-text]:text-sm">
                  <RichPreview content={version.contentJson} />
                </div>
                <button
                  onClick={() =>
                    restore.mutate(
                      { docId, versionId: v._id },
                      {
                        onSuccess: (doc) => {
                          onRestored(doc.title);
                          setSelected(null);
                          toast.success("Restored. The version you replaced is in history too.");
                        },
                        onError: (err) => toast.error(errorMessage(err, "Couldn't restore")),
                      },
                    )
                  }
                  disabled={restore.isPending}
                  className="mt-3 w-full rounded-md bg-emerald-600 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                >
                  {restore.isPending ? "Restoring…" : "Restore this version"}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
