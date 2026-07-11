import { motion } from "framer-motion";
import {
  ArrowLeft,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Sparkles,
  ExternalLink,
} from "@/components/icons";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";

const STATUS_STYLES = {
  uploaded: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  processing: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  ready: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  failed: "bg-red-500/10 text-red-400 border-red-500/20",
};

const STATUS_ICONS = {
  uploaded: Clock,
  processing: Loader2,
  ready: CheckCircle2,
  failed: XCircle,
};

export default function RAGDocDetail() {
  const backendURL = import.meta.env.VITE_BACKEND_URL;
  const navigate = useNavigate();
  const { id } = useParams();

  const [document, setDocument] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${backendURL}/api/upload/document/${id}`, {
          withCredentials: true,
        });
        setDocument(res.data.document);
        setChunks(res.data.chunks);
      } catch (err) {
        setError("Failed to load document");
      } finally {
        setLoading(false);
      }
    };
    fetchDocument();
  }, [backendURL, id]);

  const handleDelete = async () => {
    if (!confirm("Delete this document? This cannot be undone.")) return;

    setDeleting(true);
    try {
      await axios.delete(`${backendURL}/api/upload/document/${id}`, {
        withCredentials: true,
      });
      navigate("/rag-docs");
    } catch (err) {
      setError("Failed to delete document");
      setDeleting(false);
    }
  };

  const formatDate = (date) =>
    new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error && !document) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-zinc-500">
        <p className="text-red-400 bg-red-400/10 px-4 py-2 rounded-md text-sm mb-4">
          {error}
        </p>
        <button
          onClick={() => navigate("/rag-docs")}
          className="text-sm text-emerald-500 hover:text-emerald-400 font-medium"
        >
          &larr; Back to RAG Docs
        </button>
      </div>
    );
  }

  const StatusIcon = STATUS_ICONS[document.ragStatus] || Clock;

  return (
    <div className="mx-auto max-w-6xl">
      <main className="w-full">
            {/* --- Header --- */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => navigate("/rag-docs")}
                  className="p-2 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors shrink-0"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 bg-zinc-800 rounded-md flex items-center justify-center text-zinc-400 border border-zinc-700/50 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl font-semibold tracking-tight text-white truncate">
                    {document.fileName}
                  </h1>
                  <span
                    className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium border uppercase tracking-wider ${STATUS_STYLES[document.ragStatus]}`}
                  >
                    <StatusIcon
                      className={`w-3 h-3 ${document.ragStatus === "processing" ? "animate-spin" : ""}`}
                    />
                    {document.ragStatus}
                  </span>
                </div>
              </div>

              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete Document
              </button>
            </div>

            {error && (
              <div className="mb-6 text-center">
                <p className="text-red-400 bg-red-400/10 px-4 py-2 rounded-md inline-block text-sm">
                  {error}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* --- Preview --- */}
              <div className="lg:col-span-2 border border-zinc-800 rounded-xl bg-zinc-900/30 overflow-hidden flex flex-col h-[600px]">
                <div className="shrink-0 h-12 px-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/95">
                  <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Preview
                  </h3>
                  <a
                    href={document.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                  >
                    Open original <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <iframe
                  src={document.fileUrl}
                  title={document.fileName}
                  className="flex-1 w-full bg-white"
                />
              </div>

              {/* --- Metadata + Chunks --- */}
              <div className="space-y-6">
                <div className="border border-zinc-800 rounded-xl bg-zinc-900/30 p-5">
                  <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">
                    Details
                  </h3>
                  <dl className="space-y-2.5 text-sm">
                    <div className="flex items-center justify-between">
                      <dt className="text-zinc-500">Type</dt>
                      <dd className="text-zinc-300">{document.mimeType}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-zinc-500">Size</dt>
                      <dd className="text-zinc-300">
                        {(document.fileSize / 1024).toFixed(1)} KB
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-zinc-500">Uploaded</dt>
                      <dd className="text-zinc-300">{formatDate(document.createdAt)}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-zinc-500">Chunks</dt>
                      <dd className="text-zinc-300">{chunks.length}</dd>
                    </div>
                  </dl>
                </div>

                <div className="border border-zinc-800 rounded-xl bg-zinc-900/30 flex flex-col max-h-[420px]">
                  <div className="shrink-0 px-5 py-3 border-b border-zinc-800 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      RAG Chunks
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                    {chunks.length === 0 ? (
                      <p className="text-sm text-zinc-500 p-2">
                        No chunks yet — ragify this document first.
                      </p>
                    ) : (
                      chunks.map((chunk) => (
                        <div
                          key={chunk.chunkIndex}
                          className="bg-zinc-900/60 border border-zinc-800 rounded-md p-3"
                        >
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                            Chunk {chunk.chunkIndex + 1}
                          </span>
                          <p className="text-xs text-zinc-400 mt-1 line-clamp-4 leading-relaxed">
                            {chunk.text}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
      </main>
    </div>
  );
}
