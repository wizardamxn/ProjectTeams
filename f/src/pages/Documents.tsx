import { motion } from "framer-motion";
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  Star,
  Loader2,
  Clock,
  Search,
} from "@/components/icons";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import { HoverEffect } from "@/components/ace/card-hover-effect";
import { HoverBorderGradient } from "@/components/ace/hover-border-gradient";

interface Author {
  name: string;
  email: string;
  avatar?: string;
}
interface Version {
  content: string;
  updatedAt: Date;
}
interface Document {
  _id: string;
  title: string;
  content: string;
  summary?: string;
  tags: string[];
  createdBy: string;
  teamId: string;
  author: Author;
  versions: Version[];
  starred?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export default function Documents() {
  const backendURL = import.meta.env.VITE_BACKEND_URL;
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${backendURL}/api/doc/teamdocs`, {
          withCredentials: true,
        });
        setDocuments(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };
    fetchDocuments();
  }, []);

  const handleStar = async (doc_id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const originalDocs = [...documents];
    try {
      setDocuments((prev) =>
        prev.map((doc) =>
          doc._id === doc_id ? { ...doc, starred: !doc.starred } : doc,
        ),
      );
      await axios.put(
        `${backendURL}/api/doc/star/${doc_id}`,
        {},
        { withCredentials: true },
      );
    } catch (err) {
      setDocuments(originalDocs);
      console.error("Failed to star document:", err);
    }
  };

  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffHours < 24) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this document?")) return;
    try {
      await axios.delete(`${backendURL}/api/doc/teamdocs/${id}`, {
        withCredentials: true,
      });
      setDocuments(documents.filter((doc) => doc._id !== id));
    } catch (err) {
      alert("Failed to delete document");
    }
  };

  const filteredDocuments = documents.filter(
    (doc) =>
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.tags.some((tag) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
  );

  return (
    <div className="mx-auto max-w-6xl">
      {/* --- Header --- */}
      <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <span className="text-sm font-semibold uppercase tracking-widest text-emerald-500">
            Knowledge base
          </span>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
            Documents
          </h1>
        </div>

        <div className="flex w-full items-center gap-3 md:w-auto">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents…"
              className="w-full rounded-full border border-white/10 bg-zinc-900 py-2.5 pl-10 pr-4 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-500/50"
            />
          </div>
          <button onClick={() => navigate("/create")}>
            <HoverBorderGradient className="whitespace-nowrap px-4 py-2.5 text-sm font-semibold">
              <span className="flex items-center gap-1.5">
                <Plus className="h-4 w-4" /> New
              </span>
            </HoverBorderGradient>
          </button>
        </div>
      </div>

      {/* --- Content --- */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-zinc-700" />
          <p className="text-sm">Loading workspace…</p>
        </div>
      ) : error ? (
        <div className="py-20 text-center">
          <p className="inline-block rounded-md bg-red-400/10 px-4 py-2 text-sm text-red-400">
            {error}
          </p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-zinc-900/30 py-20 text-zinc-500">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-zinc-900">
            <FileText className="h-8 w-8 opacity-20" />
          </div>
          <h3 className="mb-1 font-medium text-zinc-300">No documents found</h3>
          <p className="mb-6 max-w-xs text-center text-sm">
            {searchQuery
              ? "Try adjusting your search terms."
              : "Get started by creating your first team document."}
          </p>
          {!searchQuery && (
            <button
              onClick={() => navigate("/create")}
              className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
            >
              Create a document &rarr;
            </button>
          )}
        </div>
      ) : (
        <HoverEffect
          items={filteredDocuments}
          onItemClick={(doc) => navigate(`/editor/${doc._id}`)}
          renderItem={(doc) => (
            <div className="flex h-[224px] cursor-pointer flex-col p-5">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-white/[0.06] bg-zinc-800 text-zinc-400">
                  <FileText className="h-5 w-5" />
                </div>
                <button
                  onClick={(e) => handleStar(doc._id, e)}
                  className={`rounded-md p-1.5 transition-colors ${
                    doc.starred
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300"
                  }`}
                >
                  <Star
                    className={`h-4 w-4 ${doc.starred ? "fill-current" : ""}`}
                  />
                </button>
              </div>

              <div className="min-h-0 flex-1">
                <h3 className="mb-1 truncate pr-4 font-medium text-zinc-100">
                  {doc.title}
                </h3>
                <p className="line-clamp-2 text-sm leading-relaxed text-zinc-500">
                  {doc.summary || "No summary provided."}
                </p>
              </div>

              <div className="mb-4 mt-4 flex flex-wrap gap-2">
                {doc.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded border border-emerald-500/15 bg-emerald-500/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-300/80"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(doc.updatedAt)}
                  <span className="mx-1">•</span>
                  <span className="text-zinc-400">{doc.author?.name}</span>
                </span>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/editor/${doc._id}`);
                    }}
                    className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(doc._id, e)}
                    className="rounded p-1.5 text-zinc-400 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}
