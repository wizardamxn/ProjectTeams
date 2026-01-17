import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import {
  Sparkles,
  FileText,
  Save,
  Loader2,
  Tag as TagIcon,
  Wand2,
  AlignLeft,
  PenTool,
  X,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
const backendURL = import.meta.env.VITE_BACKEND_URL;

// Mock API for compilation (Replace with your actual import)
const api = axios.create({ baseURL: `${backendURL}` });

export default function Create() {
  const navigate = useNavigate();

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  // UI state
  const [saving, setSaving] = useState(false);
  const [generatingTags, setGeneratingTags] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [improving, setImproving] = useState(false);

  // Constants
  const TITLE_MAX = 100;
  const CONTENT_MAX = 5000;

  // --- Handlers (Kept exactly as provided) ---
  const handleAddTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (indexToRemove: number) => {
    setTags(tags.filter((_, index) => index !== indexToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleGenerateTags = async () => {
    if (!content.trim()) return toast.error("Write some content first");
    try {
      setGeneratingTags(true);
      const response = await api.post("/generate-tags", { content });
      const generatedTags = response.data.tags || [];
      setTags([...new Set([...tags, ...generatedTags])]);
      toast.success("Tags generated");
    } catch (error: any) {
      toast.error("Failed to generate tags");
    } finally {
      setGeneratingTags(false);
    }
  };

  const handleSummarize = async () => {
    if (!content.trim()) return toast.error("Write some content first");
    try {
      setSummarizing(true);
      const response = await api.post(
        "/summarize",
        { content },
        { withCredentials: true },
      );
      console.log(response);
      setSummary(response.data.summary || "");
      toast.success("Summary generated");
    } catch (error: any) {
      toast.error("Failed to summarize");
    } finally {
      setSummarizing(false);
    }
  };

  const handleImproveWriting = async () => {
    if (!content.trim()) return toast.error("Write some content first");
    try {
      setImproving(true);
      const response = await api.post("/improve-writing", { content });
      setContent(response.data.improvedContent || content);
      toast.success("Writing improved");
    } catch (error: any) {
      toast.error("Failed to improve writing");
    } finally {
      setImproving(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return toast.error("Enter a title");
    if (!content.trim()) return toast.error("Add content");
    if (title.length > TITLE_MAX) return toast.error("Title too long");
    if (content.length > CONTENT_MAX) return toast.error("Content too long");

    try {
      setSaving(true);
      const documentData = {
        title: title.trim(),
        content: content.trim(),
        summary: summary.trim(),
        tags,
        starred: false,
      };
      const response = await axios.post(`${backendURL}/create`, documentData, {
        withCredentials: true,
      });
      toast.success("Document created");
      if (response.data.id) navigate(`/editor/${response.data.id}`);
      else navigate("/documents");
    } catch (error: any) {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-zinc-800">
      <div className="max-w-[1920px] mx-auto min-h-screen flex flex-col">
        {/* Navbar */}

        <div className="flex flex-1 overflow-hidden h-[calc(100vh-64px)]">
          {/* 1. Global Navigation (Left) */}

          {/* 2. Main Editor (Center) */}
          <main className="flex-1 flex flex-col relative min-w-0 bg-[#09090b]">
            {/* Toolbar */}
            <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-20">
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <span>Documents</span>
                <ChevronRight className="w-4 h-4" />
                <span className="text-zinc-200">New Draft</span>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`text-xs ${
                    content.length > CONTENT_MAX
                      ? "text-red-400"
                      : "text-zinc-600"
                  }`}
                >
                  {content.length} chars
                </span>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-zinc-100 text-zinc-950 px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 disabled:opacity-50"
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

            {/* Scrollable Editor Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="max-w-3xl mx-auto px-8 py-12">
                {/* Title Input */}
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Untitled Document"
                  maxLength={TITLE_MAX}
                  className="w-full bg-transparent text-4xl font-bold text-zinc-100 placeholder:text-zinc-700 outline-none border-none p-0 mb-8"
                />

                {/* Content Input */}
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Start writing or type '/' for commands..."
                  className="w-full min-h-[60vh] bg-transparent text-lg text-zinc-300 placeholder:text-zinc-700 outline-none border-none p-0 resize-none leading-relaxed font-serif-optional"
                />

                {/* Bottom Metadata Section */}
                <div className="mt-12 pt-8 border-t border-zinc-800 space-y-6">
                  {/* Tags */}
                  <div>
                    <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3 block">
                      Tags
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {tags.map((tag, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 text-sm border border-zinc-700"
                        >
                          {tag}
                          <button
                            onClick={() => handleRemoveTag(i)}
                            className="hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="+ Add tag"
                        className="bg-transparent text-sm text-zinc-400 placeholder:text-zinc-600 outline-none min-w-[80px] py-1"
                      />
                    </div>
                  </div>

                  {/* Summary Result Display */}
                  {summary && (
                    <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
                      <div className="flex items-center gap-2 mb-2 text-zinc-400">
                        <AlignLeft className="w-4 h-4" />
                        <span className="text-sm font-medium">Summary</span>
                      </div>
                      <p className="text-sm text-zinc-300 leading-relaxed">
                        {summary}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </main>

          {/* 3. AI Assistant Panel (Right) */}
          <aside className="w-80 border-l border-zinc-800 bg-zinc-900/30 p-4 hidden xl:flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-2 px-2">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-semibold text-zinc-200">
                AI Assistant
              </h3>
            </div>

            <div className="space-y-3">
              <ToolButton
                icon={<Wand2 className="w-4 h-4 text-purple-400" />}
                title="Generate Tags"
                desc="Auto-categorize this doc"
                onClick={handleGenerateTags}
                loading={generatingTags}
                disabled={!content.trim()}
              />
              <ToolButton
                icon={<AlignLeft className="w-4 h-4 text-blue-400" />}
                title="Summarize"
                desc="Create a brief overview"
                onClick={handleSummarize}
                loading={summarizing}
                disabled={!content.trim()}
              />
              <ToolButton
                icon={<PenTool className="w-4 h-4 text-orange-400" />}
                title="Improve Writing"
                desc="Fix grammar & tone"
                onClick={handleImproveWriting}
                loading={improving}
                disabled={!content.trim()}
              />
            </div>

            <div className="mt-auto p-4 bg-zinc-900 rounded-lg border border-zinc-800">
              <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                Pro Tip
              </h4>
              <p className="text-xs text-zinc-400">
                Use{" "}
                <kbd className="bg-zinc-800 px-1 rounded border border-zinc-700">
                  Cmd
                </kbd>{" "}
                +{" "}
                <kbd className="bg-zinc-800 px-1 rounded border border-zinc-700">
                  S
                </kbd>{" "}
                to save your changes instantly without clicking the button.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

// Helper Component for AI Buttons
function ToolButton({ icon, title, desc, onClick, loading, disabled }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full text-left p-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-all group disabled:opacity-50 disabled:cursor-not-allowed hover:border-zinc-700"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 p-1.5 bg-zinc-950 rounded border border-zinc-800 group-hover:border-zinc-700 transition-colors">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
          ) : (
            icon
          )}
        </div>
        <div>
          <div className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">
            {title}
          </div>
          <div className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">
            {desc}
          </div>
        </div>
      </div>
    </button>
  );
}
