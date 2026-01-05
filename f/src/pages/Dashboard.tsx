import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { FileText, Plus, Edit, Trash2, Star, Loader2, Clock, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";

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
  const [starredDocuments, setStarredDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const getDocs = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/starred", {
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
    return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleUnstar = async (doc_id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const originalDocs = [...starredDocuments];
    try {
      setStarredDocuments((prevDocs) =>
        prevDocs.filter((doc) => doc._id !== doc_id)
      );
      await axios.put(
        `/api/star/${doc_id}`,
        {},
        { withCredentials: true }
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
      setStarredDocuments((prevDocs) =>
        prevDocs.filter((doc) => doc._id !== id)
      );
      await axios.delete(`/api/teamdocs/${id}`, {
        withCredentials: true,
      });
    } catch (err) {
      setStarredDocuments(originalDocs);
      alert("Failed to delete document");
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-zinc-800">
      <div className="max-w-[1600px] mx-auto p-4 min-h-screen flex flex-col">
        {/* Navbar */}
       

        <div className="flex flex-1 gap-6 min-h-0 mt-4">
          
          <main className="flex-1 w-full">
            {/* --- Header Section --- */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-white">Dashboard</h1>
                <p className="text-sm text-zinc-400 mt-1">
                  Welcome back, John. You have <span className="text-zinc-200 font-medium">{starredDocuments.length} starred</span> documents.
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate("/create")}
                className="bg-zinc-100 hover:bg-white text-zinc-950 px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 shadow-sm transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Quick Create</span>
              </motion.button>
            </div>

            {/* --- Section Title --- */}
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-zinc-800/50">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <h2 className="text-sm font-medium text-zinc-200 uppercase tracking-wider">Favorites</h2>
            </div>

            {/* --- Content Area --- */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-zinc-700" />
                <p className="text-sm">Loading dashboard...</p>
              </div>
            ) : error ? (
              <div className="text-center py-20">
                <p className="text-red-400 bg-red-400/10 px-4 py-2 rounded-md inline-block text-sm">{error}</p>
              </div>
            ) : starredDocuments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-500 border border-dashed border-zinc-800 rounded-lg bg-zinc-900/30">
                <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4 border border-zinc-800">
                    <Star className="w-8 h-8 opacity-20" />
                </div>
                <h3 className="text-zinc-300 font-medium mb-1">No starred documents</h3>
                <p className="text-sm max-w-xs text-center mb-6">
                  Star important documents to access them quickly from your dashboard.
                </p>
                <button 
                    onClick={() => navigate("/docs")}
                    className="text-sm text-emerald-500 hover:text-emerald-400 font-medium"
                >
                    Browse all documents &rarr;
                </button>
              </div>
            ) : (
              /* --- Grid Layout --- */
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {starredDocuments.map((doc) => (
                  <motion.div
                    key={doc._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => navigate(`/editor/${doc._id}`)}
                    className="group relative bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg p-5 cursor-pointer transition-all duration-200 flex flex-col h-[200px]"
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 bg-zinc-800 rounded-md flex items-center justify-center text-zinc-400 group-hover:text-emerald-400 group-hover:bg-zinc-800/80 transition-colors border border-zinc-700/50">
                        <FileText className="w-5 h-5" />
                      </div>
                      <button
                        onClick={(e) => handleUnstar(doc._id, e)}
                        className="p-1.5 rounded-md text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20 transition-colors"
                        title="Unstar"
                      >
                        <Star className="w-4 h-4 fill-current" />
                      </button>
                    </div>

                    {/* Card Content */}
                    <div className="flex-1 min-h-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-medium text-zinc-200 truncate mb-1 group-hover:text-white transition-colors">
                          {doc.title}
                        </h3>
                        <ArrowUpRight className="w-3 h-3 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-sm text-zinc-500 line-clamp-2 leading-relaxed">
                        {doc.summary || "No summary provided."}
                      </p>
                    </div>

                    {/* Card Footer */}
                    <div className="pt-3 border-t border-zinc-800/50 flex items-center justify-between text-xs text-zinc-500 mt-4">
                      <div className="flex items-center gap-2">
                         <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatRelativeTime(doc.updatedAt)}
                         </span>
                         <span>•</span>
                         <span className="text-zinc-400">{doc.author.name}</span>
                      </div>

                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                            onClick={(e) => { e.stopPropagation(); navigate(`/editor/${doc._id}`); }}
                            className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white"
                         >
                            <Edit className="w-3.5 h-3.5" />
                         </button>
                         <button 
                            onClick={(e) => handleDelete(doc._id, e)}
                            className="p-1.5 hover:bg-red-500/10 rounded text-zinc-400 hover:text-red-400"
                         >
                            <Trash2 className="w-3.5 h-3.5" />
                         </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}