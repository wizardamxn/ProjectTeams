import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { GlassCard } from "@/components/GlassCard";
import { FileText, Plus, Edit, Trash2, Eye, Star } from "lucide-react";
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
      const res = await axios.get("http://localhost:2222/starred", {
        withCredentials: true,
      });

      if (res.status !== 200) {
        throw new Error("Failed to fetch starred documents");
      }

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

  // Format timestamp to relative time
  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffWeeks = Math.floor(diffMs / 604800000);

    if (diffMins < 60)
      return `${diffMins} ${diffMins === 1 ? "minute" : "minutes"} ago`;
    if (diffHours < 24)
      return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
    if (diffDays < 7)
      return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
    return `${diffWeeks} ${diffWeeks === 1 ? "week" : "weeks"} ago`;
  };

  // Unstar document handler
  const handleUnstar = async (doc_id: string) => {
    // Save original state for rollback
    const originalDocs = [...starredDocuments];

    try {
      // Optimistically remove from UI first
      setStarredDocuments((prevDocs) =>
        prevDocs.filter((doc) => doc._id !== doc_id)
      );

      // Then make API call
      await axios.put(
        `http://localhost:2222/star/${doc_id}`,
        {},
        { withCredentials: true }
      );
    } catch (err) {
      // If API fails, rollback to original state
      setStarredDocuments(originalDocs);
      alert("Failed to unstar document. Please try again.");
      console.error("Failed to unstar document:", err);
    }
  };

  // Delete document handler
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    const originalDocs = [...starredDocuments];

    try {
      // Optimistically remove from UI
      setStarredDocuments((prevDocs) =>
        prevDocs.filter((doc) => doc._id !== id)
      );

      await axios.delete(`http://localhost:2222/teamdocs/${id}`, {
        withCredentials: true,
      });
    } catch (err) {
      // Rollback on error
      setStarredDocuments(originalDocs);
      alert(err instanceof Error ? err.message : "Failed to delete document");
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden p-6">
      {/* Background effects */}
      <div className="absolute inset-0 gradient-radial opacity-50" />

      <div className="relative z-10 max-w-7xl mx-auto">
        <Navbar />

        <div className="flex gap-6">
          <Sidebar />

          <main className="flex-1">
            {/* Welcome banner */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-8 mb-6 bg-gradient-purple-blue"
            >
              <h1 className="text-3xl font-bold mb-2">Welcome back, John!</h1>
              <p className="text-foreground/80">
                You have {starredDocuments.length} starred{" "}
                {starredDocuments.length === 1 ? "document" : "documents"}
              </p>
            </motion.div>

            {/* Starred Documents */}
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <Star className="w-6 h-6 text-primary fill-primary" />
                Starred Documents
              </h2>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate("/create")}
                className="bg-gradient-purple-blue px-6 py-3 rounded-xl font-semibold flex items-center gap-2 hover:shadow-lg hover:shadow-primary/50 transition-all"
              >
                <Plus className="w-5 h-5" />
                Create Document
              </motion.button>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  Loading starred documents...
                </p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="text-center py-12">
                <p className="text-destructive">{error}</p>
              </div>
            )}

            {/* Documents Grid */}
            {!loading && !error && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {starredDocuments.map((doc) => (
                  <GlassCard key={doc._id}>
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg mb-1 truncate">
                          {doc.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {doc.summary || doc.content.substring(0, 100) + "..."}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {doc.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-lg"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                      <span>Edited {formatRelativeTime(doc.updatedAt)}</span>
                      <span className="text-xs">By {doc.author.name}</span>
                    </div>

                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate(`/editor/${doc._id}`)}
                        className="flex-1 glass-card px-3 py-2 hover:bg-primary/10 transition-colors rounded-lg flex items-center justify-center gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        <span className="text-sm">Edit</span>
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleUnstar(doc._id)}
                        className="glass-card px-3 py-2 bg-yellow-400/20 text-yellow-400 hover:bg-yellow-400/30 transition-colors rounded-lg flex items-center justify-center gap-2"
                      >
                        <Star className="w-4 h-4 fill-current" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleDelete(doc._id)}
                        className="glass-card px-3 py-2 hover:bg-destructive/10 transition-colors rounded-lg flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && starredDocuments.length === 0 && (
              <div className="text-center py-12">
                <Star className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground text-lg">
                  No starred documents yet
                </p>
                <p className="text-muted-foreground text-sm mt-2">
                  Star your favorite documents to see them here
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
