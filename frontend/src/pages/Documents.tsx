import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { GlassCard } from "@/components/GlassCard";
import { FileText, Plus, Edit, Trash2, Search, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
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

export default function Documents() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch documents from backend
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true);
        const response = await axios.get("http://localhost:2222/teamdocs", {
          withCredentials: true,
        });

        if (response.status !== 200) {
          throw new Error("Failed to fetch documents");
        }

        setDocuments(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  const handleStar = async (doc_id: string) => {
    // Save original state for rollback
    const originalDocs = [...documents];

    try {
      // Optimistically update UI first
      setDocuments((prevDocs) =>
        prevDocs.map((doc) =>
          doc._id === doc_id ? { ...doc, starred: !doc.starred } : doc
        )
      );

      // Then make API call
      await axios.put(
        `http://localhost:2222/star/${doc_id}`,
        {},
        { withCredentials: true }
      );
    } catch (err) {
      // If API fails, rollback to original state
      setDocuments(originalDocs);
      alert("Failed to star document. Please try again.");
      console.error("Failed to star document:", err);
    }
  };

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

  // Delete document handler
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      await axios.delete(`http://localhost:2222/teamdocs/${id}`, {
        withCredentials: true,
      });

      // Remove document from state
      setDocuments(documents.filter((doc) => doc._id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete document");
    }
  };

  // Filter documents based on search query
  const filteredDocuments = documents.filter(
    (doc) =>
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.tags.some((tag) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      ) ||
      doc.author.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen relative overflow-hidden p-6">
      {/* Background effects */}
      <div className="absolute inset-0 gradient-radial opacity-50" />

      <div className="relative z-10 max-w-7xl mx-auto">
        <Navbar />

        <div className="flex gap-6">
          <Sidebar />

          <main className="flex-1">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <h1 className="text-3xl font-bold mb-4">All Documents</h1>

              {/* Search and Create */}
              <div className="flex items-center gap-4">
                <div className="flex-1 glass-card p-3 flex items-center gap-3">
                  <Search className="w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none"
                  />
                </div>
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
            </motion.div>

            {/* Loading State */}
            {loading && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading documents...</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="text-center py-12">
                <p className="text-destructive">{error}</p>
              </div>
            )}

            {/* Documents grid */}
            {!loading && !error && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDocuments.map((doc) => (
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
                        onClick={() => handleStar(doc._id)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={
                          doc?.starred
                            ? "glass-card px-3 py-2 bg-yellow-400/20 text-yellow-400 transition-colors rounded-lg flex items-center justify-center gap-2"
                            : "glass-card px-3 py-2 hover:bg-secondary/10 transition-colors rounded-lg flex items-center justify-center gap-2"
                        }
                      >
                        <Star
                          className={
                            doc?.starred ? "w-4 h-4 fill-current" : "w-4 h-4"
                          }
                        />
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

            {!loading && !error && filteredDocuments.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {searchQuery
                    ? "No documents found matching your search."
                    : "No documents yet. Create your first document!"}
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
