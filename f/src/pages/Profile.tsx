import { motion } from "framer-motion";
import {
  FileText,
  Mail,
  Calendar,
  Loader2,
  Hash,
  Copy,
  Check,
  Star,
  ChevronRight,
} from "@/components/icons";
import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Author {
  name: string;
}
interface Document {
  _id: string;
  title: string;
  content: string;
  tags: string[];
  createdBy: string;
  teamId: string;
  author: Author;
  versions: any[];
  createdAt: string;
  updatedAt: string;
  summary: string;
  starred: boolean;
}
interface ProfileData {
  _id: string;
  fullName: string;
  email: string;
  teamCode: string;
  createdAt: string;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [copied, setCopied] = useState(false);
  const backendURL = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const profileRes = await axios.get(`${backendURL}/api/profile/profile`, {
          withCredentials: true,
        });
        setProfile(profileRes.data);
        const docsRes = await axios.get(`${backendURL}/api/doc/viewdocs`, {
          withCredentials: true,
        });
        setDocuments(docsRes.data);
      } catch (error) {
        console.error("Failed to load data", error);
        toast.error("Could not load profile data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const copyCode = async () => {
    if (!profile?.teamCode) return;
    try {
      await navigator.clipboard.writeText(profile.teamCode);
      setCopied(true);
      toast.success("Team code copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  const stats = [
    {
      label: "Team code",
      value: profile?.teamCode,
      icon: Hash,
      mono: true,
      action: (
        <button
          onClick={copyCode}
          className="ml-auto flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:text-white"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> Copy
            </>
          )}
        </button>
      ),
    },
    {
      label: "Member since",
      value: profile ? formatDate(profile.createdAt) : "—",
      icon: Calendar,
    },
    {
      label: "Documents",
      value: String(documents.length),
      icon: FileText,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      {/* --- Header --- */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-5 rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-8 sm:flex-row sm:items-center"
      >
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-3xl font-bold text-white">
          {profile?.fullName?.charAt(0)?.toUpperCase() || "U"}
        </div>
        <div className="text-center sm:text-left">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {profile?.fullName}
          </h1>
          <div className="mt-1 flex items-center justify-center gap-2 text-sm text-zinc-400 sm:justify-start">
            <Mail className="h-3.5 w-3.5" />
            {profile?.email}
          </div>
        </div>
      </motion.div>

      {/* --- Stats --- */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.05 }}
            className="rounded-xl border border-white/[0.08] bg-zinc-900/40 p-4"
          >
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
              <s.icon className="h-3.5 w-3.5" />
              {s.label}
            </div>
            <div className="flex items-center">
              <span
                className={`text-lg font-semibold text-zinc-100 ${
                  s.mono ? "font-mono tracking-widest" : ""
                }`}
              >
                {s.value}
              </span>
              {s.action}
            </div>
          </motion.div>
        ))}
      </div>

      {/* --- Documents --- */}
      <div className="mb-4 mt-10 flex items-center justify-between border-b border-white/[0.06] pb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-300">
          <FileText className="h-4 w-4 text-emerald-400" />
          My Documents
        </h2>
        <span className="text-sm text-zinc-500">{documents.length} files</span>
      </div>

      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-zinc-900/30 py-16 text-zinc-500">
          <FileText className="mb-4 h-10 w-10 opacity-20" />
          <p className="text-sm">You haven't created any documents yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {documents.map((doc, i) => (
            <motion.button
              key={doc._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => navigate(`/editor/${doc._id}`)}
              className="group flex flex-col rounded-xl border border-white/[0.08] bg-zinc-900/40 p-5 text-left transition-colors hover:border-emerald-500/30"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-md border border-white/[0.06] bg-zinc-800 text-zinc-400 transition-colors group-hover:text-emerald-400">
                  <FileText className="h-4 w-4" />
                </div>
                {doc.starred && (
                  <Star className="h-4 w-4 fill-emerald-400 text-emerald-400" />
                )}
              </div>
              <h3 className="mb-1 truncate font-medium text-zinc-100">
                {doc.title || "Untitled Document"}
              </h3>
              <p className="line-clamp-2 h-10 text-sm leading-relaxed text-zinc-500">
                {doc.summary || ""}
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs text-zinc-500">
                <span>Updated {formatDate(doc.updatedAt)}</span>
                <span className="flex items-center gap-1 font-medium text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100">
                  Open <ChevronRight className="h-3 w-3" />
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
