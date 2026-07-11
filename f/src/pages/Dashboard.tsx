import { motion } from "framer-motion";
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  Star,
  Loader2,
  Clock,
  ArrowUpRight,
  MessageSquare,
  UserPlus,
  Sparkles,
} from "@/components/icons";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import { useSelector } from "react-redux";
import { HoverEffect } from "@/components/ace/card-hover-effect";

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

export default function Dashboard() {
  const backendURL = import.meta.env.VITE_BACKEND_URL;

  const [starredDocuments, setStarredDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const user = useSelector((store: any) => store.user.user);

  const getDocs = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${backendURL}/api/doc/starred`, {
        withCredentials: true,
      });
      setStarredDocuments(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getDocs();
  }, []);

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

  const handleUnstar = async (doc_id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const originalDocs = [...starredDocuments];
    try {
      setStarredDocuments((prev) => prev.filter((doc) => doc._id !== doc_id));
      await axios.put(
        `${backendURL}/api/doc/star/${doc_id}`,
        {},
        { withCredentials: true },
      );
    } catch (err) {
      setStarredDocuments(originalDocs);
      console.error("Failed to unstar document:", err);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this document?")) return;
    const originalDocs = [...starredDocuments];
    try {
      setStarredDocuments((prev) => prev.filter((doc) => doc._id !== id));
      await axios.delete(`${backendURL}/api/doc/teamdocs/${id}`, {
        withCredentials: true,
      });
    } catch (err) {
      setStarredDocuments(originalDocs);
      alert("Failed to delete document");
    }
  };

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = user?.fullName?.split(" ")[0] ?? "there";
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const actions = [
    {
      label: "New document",
      desc: "Start writing",
      icon: Plus,
      onClick: () => navigate("/create"),
    },
    {
      label: "Open chat",
      desc: "Message your team",
      icon: MessageSquare,
      onClick: () => navigate("/chat"),
    },
    {
      label: "Invite a teammate",
      desc: "Share your code",
      icon: UserPlus,
      onClick: () => navigate("/team"),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      {/* --- Greeting --- */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <p className="mb-1 text-sm text-zinc-500">{today}</p>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {greeting},{" "}
          <span className="text-gradient">{firstName}</span>
        </h1>
      </motion.div>

      {/* --- Stat + action tiles --- */}
      <div className="mb-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="col-span-2 flex items-center gap-4 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.08] to-transparent p-5 lg:col-span-1"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <Star className="h-6 w-6 fill-emerald-400/30" />
          </div>
          <div>
            <div className="text-3xl font-bold text-white">
              {loading ? "—" : starredDocuments.length}
            </div>
            <div className="text-xs text-zinc-400">Starred documents</div>
          </div>
        </motion.div>

        {actions.map((a, i) => (
          <motion.button
            key={a.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            whileHover={{ y: -3 }}
            onClick={a.onClick}
            className="group flex flex-col items-start gap-3 rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-5 text-left transition-colors hover:border-emerald-500/30"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 transition-colors group-hover:bg-emerald-500/15 group-hover:text-emerald-400">
              <a.icon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1 text-sm font-semibold text-zinc-100">
                {a.label}
                <ArrowUpRight className="h-3.5 w-3.5 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-emerald-400" />
              </div>
              <div className="text-xs text-zinc-500">{a.desc}</div>
            </div>
          </motion.button>
        ))}
      </div>

      {/* --- Favorites --- */}
      <div className="mb-4 flex items-center gap-2 border-b border-white/[0.06] pb-3">
        <Star className="h-4 w-4 fill-emerald-400 text-emerald-400" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
          Favorites
        </h2>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-zinc-700" />
          <p className="text-sm">Loading dashboard…</p>
        </div>
      ) : error ? (
        <div className="py-20 text-center">
          <p className="inline-block rounded-md bg-red-400/10 px-4 py-2 text-sm text-red-400">
            {error}
          </p>
        </div>
      ) : starredDocuments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-zinc-900/30 py-20 text-zinc-500">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-zinc-900">
            <Star className="h-8 w-8 opacity-20" />
          </div>
          <h3 className="mb-1 font-medium text-zinc-300">
            No starred documents
          </h3>
          <p className="mb-6 max-w-xs text-center text-sm">
            Star important documents to access them quickly from your dashboard.
          </p>
          <button
            onClick={() => navigate("/documents")}
            className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
          >
            Browse all documents &rarr;
          </button>
        </div>
      ) : (
        <HoverEffect
          items={starredDocuments}
          className="lg:grid-cols-3"
          onItemClick={(doc) => navigate(`/editor/${doc._id}`)}
          renderItem={(doc) => (
            <div className="flex h-[200px] cursor-pointer flex-col p-5">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-white/[0.06] bg-zinc-800 text-zinc-400">
                  <FileText className="h-5 w-5" />
                </div>
                <button
                  onClick={(e) => handleUnstar(doc._id, e)}
                  className="rounded-md bg-emerald-500/10 p-1.5 text-emerald-400 transition-colors hover:bg-emerald-500/20"
                  title="Unstar"
                >
                  <Star className="h-4 w-4 fill-current" />
                </button>
              </div>

              <div className="min-h-0 flex-1">
                <h3 className="mb-1 truncate font-medium text-zinc-100">
                  {doc.title}
                </h3>
                <p className="line-clamp-2 text-sm leading-relaxed text-zinc-500">
                  {doc.summary || "No summary provided."}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs text-zinc-500">
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
