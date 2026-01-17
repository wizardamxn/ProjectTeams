import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Save,
  Loader2,
  ArrowLeft,
  Calendar,
  Clock,
  X,
  AlignLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const Editor = () => {
  const { doc_id } = useParams();
  const navigate = useNavigate();
  const backendURL = import.meta.env.VITE_BACKEND_URL;

  // Form State
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]); // Changed to array for better UI
  const [tagInput, setTagInput] = useState("");
  const [summary, setSummary] = useState("");

  // Status State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Constants
  const TITLE_MAX = 100;
  const CONTENT_MAX = 10000;

  // --- Effects ---

  // 1. Fetch Document
  useEffect(() => {
    if (doc_id) {
      fetchDocument();
    } else {
      setLoading(false);
    }
  }, [doc_id]);

  // 2. Auto-save Logic
  useEffect(() => {
    if (!loading && doc_id) {
      const autoSaveTimer = setTimeout(() => {
        if (title || content) {
          handleSave(true); // Silent save
        }
      }, 30000); // 30 seconds debounce

      return () => clearTimeout(autoSaveTimer);
    }
  }, [title, content, tags, summary, loading]);

  // --- Handlers ---

  const fetchDocument = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${backendURL}/doc/${doc_id}`, {
        withCredentials: true,
      });
      const data = response.data;

      setTitle(data.title || "");
      setContent(data.content || "");
      // Handle tags: Backend might return array or string, we standardize to array
      setTags(Array.isArray(data.tags) ? data.tags : []);
      setSummary(data.summary || "");
      setLastSaved(data.updatedAt ? new Date(data.updatedAt) : null);
    } catch (error: any) {
      console.error("Error fetching document:", error);
      toast.error("Failed to load document");
      navigate("/documents");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (silent = false) => {
    if (!title.trim() && !silent) return toast.error("Document needs a title");

    try {
      setSaving(true);

      const documentData = {
        title,
        content,
        tags, // Send as array
        summary,
      };

      let response;
      if (doc_id) {
        response = await axios.put(
          `${backendURL}/edit/${doc_id}`,
          documentData,
          { withCredentials: true },
        );
      } else {
        // Fallback if somehow we are in editor without an ID (shouldn't happen often via routing)
        response = await axios.post(`${backendURL}/create`, documentData, {
          withCredentials: true,
        });
      }

      setLastSaved(new Date());

      if (!silent) {
        toast.success("Saved successfully");
        // If we just created a new doc, update URL
        if (!doc_id && response.data.id) {
          navigate(`/editor/${response.data.id}`, { replace: true });
        }
      }
    } catch (error: any) {
      console.error("Save error:", error);
      if (!silent) toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  // Tag Handlers
  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  // --- Render ---

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-zinc-500">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
          <p className="text-sm font-medium">Loading document...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-zinc-800">
      <div className="max-w-[1920px] mx-auto min-h-screen flex flex-col">
        {/* Navbar */}

        <div className="flex flex-1 overflow-hidden h-[calc(100vh-64px)]">
          {/* Sidebar */}

          {/* Main Content */}
          <main className="flex-1 flex flex-col relative min-w-0 bg-[#09090b]">
            {/* Toolbar */}
            <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-20">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate("/documents")}
                  className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="h-4 w-[1px] bg-zinc-700 mx-1" />
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <span className="hidden sm:inline">Documents</span>
                  <ChevronRight className="w-4 h-4 hidden sm:block" />
                  <span className="text-zinc-200 font-medium truncate max-w-[200px]">
                    {title || "Untitled"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {lastSaved && (
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <Clock className="w-3 h-3" />
                    <span className="hidden sm:inline">
                      Saved{" "}
                      {lastSaved.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="sm:hidden">Saved</span>
                  </div>
                )}

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="bg-zinc-100 hover:bg-white text-zinc-950 px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 disabled:opacity-50 transition-colors"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Save
                </motion.button>
              </div>
            </div>

            {/* Scrollable Editor Canvas */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="max-w-3xl mx-auto px-6 md:px-12 py-12">
                {/* Title */}
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Untitled Document"
                  maxLength={TITLE_MAX}
                  className="w-full bg-transparent text-4xl font-bold text-zinc-100 placeholder:text-zinc-700 outline-none border-none p-0 mb-8"
                />

                {/* Content */}
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Type '/' for commands..."
                  className="w-full min-h-[50vh] bg-transparent text-lg text-zinc-300 placeholder:text-zinc-700 outline-none border-none p-0 resize-none leading-relaxed font-serif-optional mb-12"
                />

                {/* Metadata Footer */}
                <div className="pt-8 border-t border-zinc-800 space-y-8 pb-20">
                  {/* Tags Section */}
                  <div>
                    <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3 block">
                      Tags
                    </label>
                    <div className="flex flex-wrap gap-2 items-center">
                      {tags.map((tag, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 text-sm border border-zinc-700 group"
                        >
                          {tag}
                          <button
                            onClick={() => handleRemoveTag(i)}
                            className="text-zinc-500 hover:text-red-400 ml-1 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                        onBlur={handleAddTag}
                        placeholder="+ Add tag"
                        className="bg-transparent text-sm text-zinc-400 placeholder:text-zinc-600 outline-none min-w-[80px] py-1"
                      />
                    </div>
                  </div>

                  {/* Summary Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-3 text-zinc-500">
                      <AlignLeft className="w-4 h-4" />
                      <label className="text-xs font-medium uppercase tracking-wider">
                        Summary
                      </label>
                    </div>
                    <textarea
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      placeholder="Add a brief summary..."
                      rows={3}
                      className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-300 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none transition-colors resize-none"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex items-center gap-6 text-xs text-zinc-600">
                    <div className="flex items-center gap-2">
                      <span>
                        Words: {content.split(/\s+/).filter((w) => w).length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>Characters: {content.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Editor;
