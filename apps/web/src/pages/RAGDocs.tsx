import { motion } from "framer-motion";
import {
  Database,
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Send,
} from "@/components/icons";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useAskDocs,
  useIndexKnowledgeDoc,
  useKnowledgeDocs,
  useUploadKnowledgeDoc,
} from "@/api/knowledge";
import type { AskAnswer, RagStatus } from "@/api/types";
import { errorMessage } from "@/lib/api";
import { formatFileSize, formatRelativeTime } from "@/lib/format";

const STATUS_STYLES: Record<RagStatus, string> = {
  uploaded: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  processing: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  ready: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  failed: "bg-red-500/10 text-red-400 border-red-500/20",
};

const STATUS_ICONS: Record<RagStatus, typeof Clock> = {
  uploaded: Clock,
  processing: Loader2,
  ready: CheckCircle2,
  failed: XCircle,
};

interface QA {
  question: string;
  answer: string | null;
  sources: AskAnswer["sources"];
}

export default function RAGDocs() {
  const navigate = useNavigate();

  const { data: documents = [], isLoading: loading, error: loadError } = useKnowledgeDocs();
  const upload = useUploadKnowledgeDoc();
  const indexDoc = useIndexKnowledgeDoc();
  const ask = useAskDocs();
  const [actionError, setActionError] = useState<string | null>(null);
  const error = actionError ?? (loadError ? "Failed to load documents" : null);
  const uploading = upload.isPending;
  const asking = ask.isPending;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<QA[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setActionError(null);
    upload.mutate(file, {
      onError: (err) => setActionError(errorMessage(err, "Failed to upload document")),
      onSettled: () => {
        input.value = "";
      },
    });
  };

  const handleRagify = (docId: string) => {
    setActionError(null);
    indexDoc.mutate(docId, {
      onError: (err) => setActionError(errorMessage(err, "Failed to start processing")),
    });
  };

  const handleAsk = (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || asking) return;

    setQuestion("");
    setMessages((prev) => [...prev, { question: q, answer: null, sources: [] }]);
    const settleLast = (patch: Pick<QA, "answer" | "sources">) =>
      setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 ? { ...m, ...patch } : m)));

    ask.mutate(q, {
      onSuccess: (res) => settleLast({ answer: res.answer, sources: res.sources }),
      onError: (err) =>
        settleLast({ answer: errorMessage(err, "Something went wrong answering that."), sources: [] }),
    });
  };

  return (
    <div className="mx-auto max-w-6xl">
      <main className="w-full">
            {/* --- Header Section --- */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <span className="text-sm font-semibold uppercase tracking-widest text-emerald-500">
                  AI knowledge base
                </span>
                <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
                  RAG Docs
                </h1>
                <p className="text-sm text-zinc-400 mt-1">
                  Upload documents, ragify them, then ask questions grounded in your team's knowledge.
                </p>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md,.markdown,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 whitespace-nowrap rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 px-4 py-2 text-sm font-medium text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span>{uploading ? "Uploading..." : "Upload Document"}</span>
                </motion.button>
              </div>
            </div>

            {error && (
              <div className="mb-6 text-center">
                <p className="text-red-400 bg-red-400/10 px-4 py-2 rounded-md inline-block text-sm">
                  {error}
                </p>
              </div>
            )}

            {/* --- Documents Grid --- */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-zinc-700" />
                <p className="text-sm">Loading documents...</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-500 border border-dashed border-zinc-800 rounded-lg bg-zinc-900/30 mb-10">
                <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4 border border-zinc-800">
                  <Database className="w-8 h-8 opacity-20" />
                </div>
                <h3 className="text-zinc-300 font-medium mb-1">No documents yet</h3>
                <p className="text-sm max-w-xs text-center">
                  Upload a document to get started.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-10">
                {documents.map((doc) => {
                  const StatusIcon = STATUS_ICONS[doc.ragStatus] || Clock;
                  const isRagifying = indexDoc.isPending && indexDoc.variables === doc._id;
                  const canRagify = doc.ragStatus === "uploaded" || doc.ragStatus === "failed";

                  return (
                    <motion.div
                      key={doc._id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => navigate(`/rag-docs/${doc._id}`)}
                      className="group relative bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg p-5 cursor-pointer transition-all duration-200 flex flex-col h-[220px]"
                    >
                      {/* Card Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 bg-zinc-800 rounded-md flex items-center justify-center text-zinc-400 border border-zinc-700/50">
                          <FileText className="w-5 h-5" />
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-medium border uppercase tracking-wider flex items-center gap-1 ${STATUS_STYLES[doc.ragStatus]}`}
                        >
                          <StatusIcon
                            className={`w-3 h-3 ${doc.ragStatus === "processing" ? "animate-spin" : ""}`}
                          />
                          {doc.ragStatus}
                        </span>
                      </div>

                      {/* Card Content */}
                      <div className="flex-1 min-h-0">
                        <h3 className="font-medium text-zinc-200 truncate pr-4 mb-1 group-hover:text-white transition-colors">
                          {doc.fileName}
                        </h3>
                        <p className="text-sm text-zinc-500">
                          {formatFileSize(doc.fileSize)}
                        </p>
                      </div>

                      {/* Card Footer */}
                      <div className="pt-3 border-t border-zinc-800/50 flex items-center justify-between text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(doc.createdAt)}
                        </span>

                        {canRagify && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRagify(doc._id);
                            }}
                            disabled={isRagifying}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            {isRagifying ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Sparkles className="w-3 h-3" />
                            )}
                            {doc.ragStatus === "failed" ? "Retry" : "Index"}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* --- Ask Your Docs --- */}
            <div className="border border-zinc-800 rounded-xl bg-zinc-900/30 overflow-hidden flex flex-col h-[500px]">
              <div className="shrink-0 h-16 px-4 md:px-6 border-b border-zinc-800 flex items-center bg-zinc-900/95 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">Ask your docs</h3>
                    <p className="text-[11px] text-zinc-500">
                      Answers are grounded only in your ragified documents.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                    <Sparkles className="w-10 h-10 mb-4 opacity-20" />
                    <p className="text-sm">
                      Ask a question about your team's ragified documents.
                    </p>
                  </div>
                ) : (
                  messages.map((m, i) => (
                    <div key={i} className="space-y-3">
                      <div className="flex justify-end">
                        <div className="max-w-[75%] px-4 py-2 text-sm rounded-2xl shadow-sm bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-tr-none">
                          {m.question}
                        </div>
                      </div>
                      <div className="flex justify-start">
                        <div className="max-w-[75%] flex flex-col items-start">
                          <div className="px-4 py-2 text-sm rounded-2xl shadow-sm bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-tl-none">
                            {m.answer === null ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              m.answer
                            )}
                          </div>
                          {m.sources.length > 0 && m.sources[0] && (
                            <span className="text-[10px] text-zinc-600 mt-1 px-1">
                              {m.sources.length} source{m.sources.length > 1 ? "s" : ""} · top score{" "}
                              {m.sources[0].score.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} className="h-px" />
              </div>

              <div className="shrink-0 p-3 md:p-4 border-t border-zinc-800 bg-zinc-900/30 backdrop-blur-sm">
                <form onSubmit={handleAsk} className="flex gap-3">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask a question about your documents..."
                    className="flex-1 bg-zinc-900 border border-zinc-700 focus:border-zinc-500 rounded-full px-5 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!question.trim() || asking}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {asking ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5 ml-0.5" />
                    )}
                  </button>
                </form>
              </div>
            </div>
      </main>
    </div>
  );
}
