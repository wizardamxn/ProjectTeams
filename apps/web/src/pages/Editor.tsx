import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Clock,
  Loader2,
  Sparkles,
  Star,
  Tag as TagIcon,
  Trash2,
  Wand2,
  X,
} from "@/components/icons";
import { useDeleteDoc, useDoc, useFolders, useRestoreVersion, useToggleStar, useUpdateDoc, useVersion, useVersions } from "@/api/docs";
import { useGenerateTags, useImproveWriting, useSummarize } from "@/api/ai";
import type { RichDoc } from "@/api/types";
import type { JSONContent } from "@tiptap/react";
import { errorMessage } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { useAppSelector } from "@/store/hooks";
import { isAtLeast } from "@/store/slices/User";
import { RichEditorContent, RichPreview, Toolbar } from "@/components/docs/RichEditor";
import { useDocEditor } from "@/components/docs/docEditor";

const AUTOSAVE_MS = 1500;
type SaveState = "saved" | "dirty" | "saving" | "error";
type Panel = "details" | "history" | null;

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
  const [panel, setPanel] = useState<Panel>(() => (window.innerWidth >= 1280 ? "details" : null));

  // Pending changes are collected here and sent together.
  const pending = useRef<Partial<{ title: string; contentJson: RichDoc; summary: string; tags: string[]; folderId: string | null }>>({});
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

  const editor = useDocEditor({ content: doc!.contentJson, onChange: (json) => queue({ contentJson: json }) });

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

  const onDelete = () => {
    if (!confirm(`Delete "${title}"? This can't be undone.`)) return;
    pending.current = {};
    del.mutate(docId, {
      onSuccess: () => navigate("/documents", { replace: true }),
      onError: (err) => toast.error(errorMessage(err, "Couldn't delete")),
    });
  };

  const canDelete = doc!.createdBy === me?._id || isAdmin;
  const statusText =
    saveState === "saving" ? "Saving…" : saveState === "dirty" ? "Unsaved changes" : saveState === "error" ? "Not saved, retrying" : `Saved ${formatRelativeTime(savedAt) === "Today" ? savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : formatRelativeTime(savedAt)}`;

  return (
    <div className="-m-4 flex min-h-[100dvh] md:-m-8">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <div className="sticky top-0 z-20 border-b border-white/[0.06] bg-zinc-950/90 backdrop-blur">
          <div className="flex h-12 items-center gap-2 px-3 md:px-6">
            <button onClick={() => navigate("/documents")} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label="Back to documents">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <select
              value={doc!.folderId ?? ""}
              onChange={(e) => queue({ folderId: e.target.value || null })}
              aria-label="Folder"
              className="max-w-[10rem] truncate rounded-md border border-transparent bg-transparent px-1.5 py-1 text-xs text-zinc-400 hover:border-white/10 focus:border-white/10 focus:outline-none"
            >
              <option value="">No folder</option>
              {folders.map((f) => (
                <option key={f._id} value={f._id}>{f.name}</option>
              ))}
            </select>

            <span className={`ml-auto flex items-center gap-1.5 text-xs ${saveState === "error" ? "text-red-400" : "text-zinc-500"}`} aria-live="polite">
              {saveState === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saveState === "error" ? <AlertCircle className="h-3.5 w-3.5" /> : saveState === "saved" ? <Check className="h-3.5 w-3.5" /> : null}
              {statusText}
            </span>
            <button
              onClick={() => star.mutate(docId)}
              className={`rounded-md p-1.5 hover:bg-zinc-800 ${doc!.starred ? "text-amber-400" : "text-zinc-400 hover:text-white"}`}
              aria-label={doc!.starred ? "Unstar" : "Star"}
              aria-pressed={doc!.starred}
              title={doc!.starred ? "Starred (only you see your stars)" : "Star"}
            >
              <Star className={`h-4 w-4 ${doc!.starred ? "fill-current" : ""}`} />
            </button>
            <button
              onClick={() => setPanel((p) => (p === "history" ? null : "history"))}
              className={`rounded-md p-1.5 hover:bg-zinc-800 ${panel === "history" ? "text-emerald-400" : "text-zinc-400 hover:text-white"}`}
              aria-label="Version history"
              title="Version history"
            >
              <Clock className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPanel((p) => (p === "details" ? null : "details"))}
              className={`rounded-md p-1.5 hover:bg-zinc-800 ${panel === "details" ? "text-emerald-400" : "text-zinc-400 hover:text-white"}`}
              aria-label="Details and AI tools"
              title="Details and AI tools"
            >
              <Sparkles className="h-4 w-4" />
            </button>
          </div>
          {editor && (
            <div className="border-t border-white/[0.04] px-3 py-1 md:px-6">
              <Toolbar editor={editor} />
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
          <RichEditorContent editor={editor} />
        </div>
      </div>

      {/* Side panel */}
      {panel && (
        <aside className="fixed inset-y-0 right-0 z-30 w-full max-w-sm overflow-y-auto border-l border-white/[0.06] bg-zinc-950 xl:sticky xl:top-0 xl:h-[100dvh] xl:w-80">
          <div className="flex h-12 items-center justify-between border-b border-white/[0.06] px-4">
            <h2 className="text-sm font-semibold text-zinc-100">{panel === "details" ? "Details" : "Version history"}</h2>
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
                <p>Ask in Knowledge can answer from this doc a minute after you stop typing.</p>
              </section>

              {canDelete && (
                <button onClick={onDelete} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-400">
                  <Trash2 className="h-3.5 w-3.5" /> Delete document
                </button>
              )}
            </div>
          ) : (
            <History docId={docId} onRestored={(json, t) => {
              pending.current = {};
              setTitle(t);
              editor?.commands.setContent(json as JSONContent, { emitUpdate: false });
              setSaveState("saved");
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

function History({ docId, onRestored }: { docId: string; onRestored: (json: RichDoc, title: string) => void }) {
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
                          onRestored(doc.contentJson!, doc.title);
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
