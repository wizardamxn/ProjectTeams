import React, { useEffect, useRef, useState } from "react";
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
} from "@/components/icons";
import { toast } from "sonner";
import { useDoc, useUpdateDoc } from "@/api/docs";
import { errorMessage } from "@/lib/api";

const AUTOSAVE_DELAY_MS = 30_000;

const Editor = () => {
  const { doc_id } = useParams();
  const navigate = useNavigate();
  const { data: doc, isLoading: loading, error: loadError } = useDoc(doc_id);
  const updateDoc = useUpdateDoc();
  const saving = updateDoc.isPending;

  // Form State
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [summary, setSummary] = useState("");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // What was last loaded or saved, to know whether there is anything to save.
  const savedSnapshot = useRef("");
  const snapshot = JSON.stringify({ title, content, tags, summary });
  const isDirty = savedSnapshot.current !== "" && snapshot !== savedSnapshot.current;

  // Constants
  const TITLE_MAX = 100;
  const CONTENT_MAX = 100_000;

  // Fill the form once when the document arrives.
  const loadedId = useRef<string | null>(null);
  useEffect(() => {
    if (!doc || loadedId.current === doc._id) return;
    loadedId.current = doc._id;
    setTitle(doc.title ?? "");
    setContent(doc.content ?? "");
    setTags(doc.tags ?? []);
    setSummary(doc.summary ?? "");
    setLastSaved(new Date(doc.updatedAt));
    savedSnapshot.current = JSON.stringify({
      title: doc.title ?? "",
      content: doc.content ?? "",
      tags: doc.tags ?? [],
      summary: doc.summary ?? "",
    });
  }, [doc]);

  useEffect(() => {
    if (loadError) {
      toast.error(errorMessage(loadError, "Failed to load document"));
      navigate("/documents");
    }
  }, [loadError, navigate]);

  const handleSave = (silent = false) => {
    if (!doc_id) return;
    if (!title.trim()) {
      if (!silent) toast.error("Document needs a title");
      return;
    }
    const sent = snapshot;
    updateDoc.mutate(
      { id: doc_id, input: { title, content, tags, summary } },
      {
        onSuccess: () => {
          savedSnapshot.current = sent;
          setLastSaved(new Date());
          if (!silent) toast.success("Saved successfully");
        },
        onError: (err) => {
          if (!silent) toast.error(errorMessage(err, "Failed to save changes"));
        },
      },
    );
  };

  // Auto-save 30 s after the last change, only if something actually changed.
  useEffect(() => {
    if (!isDirty || saving) return;
    const timer = setTimeout(() => handleSave(true), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, isDirty]);

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

  if (loading || !doc) {
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
    <div className="flex min-h-[calc(100dvh-7rem)] overflow-hidden rounded-2xl border border-white/[0.06] bg-zinc-950 text-zinc-100 md:min-h-[calc(100dvh-4rem)]">
      {/* Main Content */}
      <main className="relative flex min-w-0 flex-1 flex-col bg-zinc-950">
            {/* Toolbar */}
            <div className="h-14 border-b border-white/[0.06] flex items-center justify-between px-6 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-20">
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
                  className="flex items-center gap-2 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 px-4 py-1.5 text-sm font-medium text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
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
  );
};

export default Editor;
