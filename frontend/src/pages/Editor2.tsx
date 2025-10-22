import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { GlassCard } from "@/components/GlassCard";
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Save,
  X,
  Loader2,
  ArrowLeft,
  FileText,
  Calendar,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const Editor = () => {
  const { doc_id } = useParams();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Fetch document on mount
  useEffect(() => {
    if (doc_id) {
      fetchDocument();
    } else {
      // New document mode
      setLoading(false);
    }
  }, [doc_id]);

  // Auto-save functionality (optional)
  useEffect(() => {
    if (!loading && doc_id) {
      const autoSaveTimer = setTimeout(() => {
        handleSave(true); // silent save
      }, 30000); // Auto-save every 30 seconds

      return () => clearTimeout(autoSaveTimer);
    }
  }, [title, content, tags, summary, loading]);

  const fetchDocument = async () => {
    try {
      setLoading(true);

      const response = await axios.get(`http://localhost:2222/edit/${doc_id}`, {
        withCredentials: true,
      });
      const data = response.data;

      // Populate form fields
      setTitle(data.title || "");
      setContent(data.content || "");
      setTags(data.tags?.join(", ") || "");
      setSummary(data.summary || "");
      setLastSaved(data.lastEdited ? new Date(data.lastEdited) : null);

      toast.success("Document loaded successfully");
    } catch (error) {
      console.error("Error fetching document:", error);
      toast.error(error.response?.data?.message || "Failed to load document");
      navigate("/documents");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (silent = false) => {
    try {
      setSaving(true);

      const documentData = {
        title,
        content,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag),
        summary,
      };

      let response;
      if (doc_id) {
        // Update existing document
        response = await api.put(`/documents/${doc_id}`, documentData);
      } else {
        // Create new document
        response = await api.post(`/documents`, documentData);
      }

      const data = response.data;
      setLastSaved(new Date());

      if (!silent) {
        toast.success("Document saved successfully");
      }

      // If it's a new document, navigate to edit mode with the new ID
      if (!doc_id && data.id) {
        navigate(`/editor/${data.id}`, { replace: true });
      }
    } catch (error) {
      console.error("Error saving document:", error);
      if (!silent) {
        toast.error(error.response?.data?.message || "Failed to save document");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (window.confirm("Are you sure you want to discard changes?")) {
      navigate("/documents");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden p-6">
        <div className="absolute inset-0 gradient-radial opacity-50" />
        <div className="relative z-10 flex items-center justify-center h-screen">
          <GlassCard>
            <div className="flex flex-col items-center gap-4 p-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading document...</p>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

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
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate("/documents")}
                    className="glass-card p-2 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </motion.button>
                  <div>
                    <h1 className="text-3xl font-bold">
                      {doc_id ? "Edit Document" : "New Document"}
                    </h1>
                    {lastSaved && (
                      <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Last saved: {lastSaved.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleDiscard}
                    className="glass-card px-4 py-2 rounded-lg hover:bg-destructive/10 transition-colors flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    <span>Discard</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleSave(false)}
                    disabled={saving}
                    className="bg-gradient-purple-blue px-6 py-2 rounded-lg font-semibold flex items-center gap-2 hover:shadow-lg hover:shadow-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save</span>
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>

            {/* Editor Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-6"
            >
              {/* Title */}
              <GlassCard>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Document Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter document title..."
                  className="glass-input w-full px-4 py-3 text-lg font-semibold focus:ring-2 focus:ring-ring focus:outline-none transition-all"
                />
              </GlassCard>

              {/* Summary */}
              <GlassCard>
                <label className="block text-sm font-medium mb-2">
                  Summary
                </label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Brief summary of the document..."
                  rows={3}
                  className="glass-input w-full px-4 py-3 focus:ring-2 focus:ring-ring focus:outline-none transition-all resize-none"
                />
              </GlassCard>

              {/* Tags */}
              <GlassCard>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g., therapy, wellness, notes"
                  className="glass-input w-full px-4 py-3 focus:ring-2 focus:ring-ring focus:outline-none transition-all"
                />
                {tags && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {tags.split(",").map((tag, idx) => {
                      const trimmedTag = tag.trim();
                      return trimmedTag ? (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-primary/20 text-primary text-sm rounded-lg"
                        >
                          {trimmedTag}
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </GlassCard>

              {/* Content Editor */}
              <GlassCard>
                <label className="block text-sm font-medium mb-2">
                  Content
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Start writing your document..."
                  rows={20}
                  className="glass-input w-full px-4 py-3 focus:ring-2 focus:ring-ring focus:outline-none transition-all resize-none font-mono text-sm"
                />
                <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                  <span>{content.length} characters</span>
                  <span>
                    {content.split(/\s+/).filter((w) => w).length} words
                  </span>
                </div>
              </GlassCard>

              {/* Bottom Actions */}
              <div className="flex justify-end gap-3 pb-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDiscard}
                  className="glass-card px-6 py-3 rounded-lg hover:bg-white/10 transition-colors font-medium"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="bg-gradient-purple-blue px-8 py-3 rounded-lg font-semibold hover:shadow-lg hover:shadow-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving
                    ? "Saving..."
                    : doc_id
                    ? "Update Document"
                    : "Create Document"}
                </motion.button>
              </div>
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Editor;
