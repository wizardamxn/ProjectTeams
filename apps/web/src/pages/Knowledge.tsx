import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  Database,
  FileText,
  Hash,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  Upload,
  XCircle,
} from "@/components/icons";
import { useAskDocs, useIndexKnowledgeDoc, useKnowledgeDocs, useUploadKnowledgeDoc } from "@/api/knowledge";
import type { AskSource, KnowledgeStats, RagStatus } from "@/api/types";
import { api, errorMessage } from "@/lib/api";
import { formatFileSize, formatRelativeTime } from "@/lib/format";

const STATUS: Record<RagStatus, { label: string; icon: typeof Clock; cls: string }> = {
  uploaded: { label: "Waiting", icon: Clock, cls: "text-zinc-400 bg-zinc-800" },
  processing: { label: "Indexing", icon: Loader2, cls: "text-amber-300 bg-amber-500/10" },
  ready: { label: "Ready", icon: CheckCircle2, cls: "text-emerald-400 bg-emerald-500/10" },
  failed: { label: "Failed", icon: XCircle, cls: "text-red-400 bg-red-500/10" },
};

const SOURCE_ICON = { doc: FileText, file: Database, chat: Hash } as const;

/** Where a citation leads. */
const sourceHref = (s: AskSource) =>
  s.type === "doc" && s.docId
    ? `/editor/${s.docId}`
    : s.type === "file" && s.fileId
      ? `/knowledge/files/${s.fileId}`
      : s.type === "chat" && s.conversationId
        ? `/chat/${s.conversationId}`
        : null;

/** The answer text with each [n] turned into a link to source n. */
function AnswerText({ text, sources }: { text: string; sources: AskSource[] }) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
      {parts.map((part, i) => {
        const n = /^\[(\d+)\]$/.exec(part)?.[1];
        const source = n ? sources.find((s) => s.n === Number(n)) : undefined;
        if (!source) return <span key={i}>{part}</span>;
        const href = sourceHref(source);
        const chipCls = "mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded bg-emerald-500/15 px-1 align-text-top text-[10px] font-semibold text-emerald-400 hover:bg-emerald-500/25";
        return href ? (
          <Link key={i} to={href} className={chipCls} title={source.title}>{n}</Link>
        ) : (
          <span key={i} className={chipCls}>{n}</span>
        );
      })}
    </p>
  );
}

function Sources({ sources }: { sources: AskSource[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {sources.map((s) => {
        const Icon = SOURCE_ICON[s.type];
        const href = sourceHref(s);
        const body: ReactNode = (
          <>
            <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-300">
              <span className="flex h-4 min-w-4 items-center justify-center rounded bg-zinc-800 px-1 text-[10px] font-semibold text-zinc-400">{s.n}</span>
              <Icon className="h-3.5 w-3.5 text-zinc-500" />
              <span className="truncate">{s.title}</span>
            </span>
            <span className="mt-1 line-clamp-2 block text-xs text-zinc-500">{s.snippet}</span>
          </>
        );
        return href ? (
          <Link key={s.n} to={href} className="block rounded-lg border border-white/[0.06] bg-zinc-900/50 p-2.5 hover:border-white/15">{body}</Link>
        ) : (
          <div key={s.n} className="rounded-lg border border-white/[0.06] bg-zinc-900/50 p-2.5">{body}</div>
        );
      })}
    </div>
  );
}

interface QA {
  question: string;
  answer: string | null;
  sources: AskSource[];
  error?: boolean;
}

const EXAMPLES = ["What did we decide about pricing?", "Summarise our onboarding process", "Who owns the API changelog?"];

export default function Knowledge() {
  const navigate = useNavigate();
  const { data: stats } = useQuery({
    queryKey: ["knowledge", "stats"],
    queryFn: () => api.get<KnowledgeStats>("/upload/stats").then((r) => r.data),
  });
  const { data: files = [], isLoading: filesLoading } = useKnowledgeDocs();
  const upload = useUploadKnowledgeDoc();
  const reindex = useIndexKnowledgeDoc();
  const ask = useAskDocs();
  const fileInput = useRef<HTMLInputElement>(null);

  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<QA[]>([]);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [history]);

  const submit = (q: string) => {
    const text = q.trim();
    if (!text || ask.isPending) return;
    setQuestion("");
    setHistory((h) => [...h, { question: text, answer: null, sources: [] }]);
    const settle = (patch: Partial<QA>) => setHistory((h) => h.map((x, i) => (i === h.length - 1 ? { ...x, ...patch } : x)));
    ask.mutate(text, {
      onSuccess: (r) => settle({ answer: r.answer, sources: r.sources }),
      onError: (err) => settle({ answer: errorMessage(err, "Something went wrong answering that."), error: true }),
    });
  };

  const onFiles = (list: FileList | null) => {
    const file = list?.[0];
    if (!file) return;
    upload.mutate(file, {
      onSuccess: () => toast.success(`${file.name} uploaded. It'll be searchable in a minute.`),
      onError: (err) => toast.error(errorMessage(err, "Upload failed")),
    });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <span className="text-sm font-semibold uppercase tracking-widest text-emerald-500">Knowledge</span>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">Ask your workspace</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Answers come only from your team's content, with links to where each fact came from.
          {stats && (
            <span className="text-zinc-500">
              {" "}Searching {stats.docs} {stats.docs === 1 ? "doc" : "docs"}, {stats.files} {stats.files === 1 ? "file" : "files"} and {stats.channels} public {stats.channels === 1 ? "channel" : "channels"}. Private channels and DMs are never used.
            </span>
          )}
        </p>
      </div>

      {/* ---- Ask ---- */}
      <section className="rounded-2xl border border-white/[0.08] bg-zinc-900/40">
        <div className="max-h-[55vh] space-y-6 overflow-y-auto p-4 md:p-6 custom-scrollbar">
          {history.length === 0 ? (
            <div className="py-6 text-center">
              <Sparkles className="mx-auto mb-3 h-8 w-8 text-emerald-400/60" />
              <p className="mb-4 text-sm text-zinc-400">Ask anything your team has written down or discussed.</p>
              <div className="flex flex-wrap justify-center gap-2">
                {EXAMPLES.map((e) => (
                  <button key={e} onClick={() => submit(e)} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:border-emerald-500/40 hover:text-white">
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            history.map((qa, i) => (
              <div key={i}>
                <p className="mb-2 flex items-start gap-2 text-sm font-semibold text-zinc-100">
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                  {qa.question}
                </p>
                <div className="ml-6">
                  {qa.answer === null ? (
                    <span className="flex items-center gap-2 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" /> Looking through your workspace…</span>
                  ) : qa.error ? (
                    <p className="text-sm text-red-400">{qa.answer}</p>
                  ) : (
                    <>
                      <AnswerText text={qa.answer} sources={qa.sources} />
                      <Sources sources={qa.sources} />
                    </>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={end} />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(question);
          }}
          className="flex items-center gap-2 border-t border-white/[0.06] p-3"
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={1000}
            placeholder="Ask a question…"
            aria-label="Ask a question"
            className="flex-1 rounded-lg bg-transparent px-2 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
          />
          <button type="submit" disabled={!question.trim() || ask.isPending} className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600" aria-label="Ask">
            {ask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </section>

      {/* ---- Files ---- */}
      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">Files</h2>
            <p className="text-xs text-zinc-500">PDFs, text, Markdown and CSV. Docs and public channels are included automatically.</p>
          </div>
          <input ref={fileInput} type="file" accept=".pdf,.txt,.md,.markdown,.csv" hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
          <button
            onClick={() => fileInput.current?.click()}
            disabled={upload.isPending}
            className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900 disabled:opacity-60"
          >
            {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload
          </button>
        </div>

        {filesLoading ? (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-zinc-600" />
        ) : files.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 py-8 text-center text-sm text-zinc-500">No files yet.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.08]">
            {files.map((f) => {
              const st = STATUS[f.ragStatus];
              return (
                <li key={f._id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02]">
                  <FileText className="h-5 w-5 shrink-0 text-zinc-500" />
                  <button onClick={() => navigate(`/knowledge/files/${f._id}`)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm text-zinc-100">{f.fileName}</span>
                    <span className="text-xs text-zinc-500">{formatFileSize(f.fileSize)} · {formatRelativeTime(f.createdAt)}</span>
                  </button>
                  <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>
                    <st.icon className={`h-3 w-3 ${f.ragStatus === "processing" ? "animate-spin" : ""}`} /> {st.label}
                  </span>
                  {f.ragStatus === "failed" && (
                    <button
                      onClick={() => reindex.mutate(f._id, { onError: (err) => toast.error(errorMessage(err, "Couldn't retry")) })}
                      className="rounded-md px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                    >
                      Retry
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
