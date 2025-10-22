import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { GlassCard } from "@/components/GlassCard";
import {
  Sparkles,
  FileText,
  Save,
  Loader2,
  Tag as TagIcon,
  User,
  Users,
} from "lucide-react";
import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function Create() {
  const navigate = useNavigate();

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [teamId, setTeamId] = useState("");

  // UI state
  const [saving, setSaving] = useState(false);
  const [generatingTags, setGeneratingTags] = useState(false);
  const [summarizing, setSummarizing] = useState(false);

  // Character limits from schema
  const TITLE_MAX = 100;
  const CONTENT_MAX = 5000;

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
    if (!content.trim()) {
      toast.error("Please write some content first");
      return;
    }

    try {
      setGeneratingTags(true);

      const response = await api.post("/ai/generate-tags", {
        content,
        title,
      });

      const generatedTags = response.data.tags || [];
      setTags([...new Set([...tags, ...generatedTags])]); // Merge and deduplicate
      toast.success("Tags generated successfully");
    } catch (error: any) {
      console.error("Error generating tags:", error);
      toast.error(error.response?.data?.message || "Failed to generate tags");
    } finally {
      setGeneratingTags(false);
    }
  };

  const handleSummarize = async () => {
    if (!content.trim()) {
      toast.error("Please write some content first");
      return;
    }

    try {
      setSummarizing(true);

      const response = await api.post("/ai/summarize", {
        content,
        title,
      });

      setSummary(response.data.summary || "");
      toast.success("Summary generated successfully");
    } catch (error: any) {
      console.error("Error summarizing:", error);
      toast.error(
        error.response?.data?.message || "Failed to generate summary"
      );
    } finally {
      setSummarizing(false);
    }
  };

  const handleImproveWriting = async () => {
    if (!content.trim()) {
      toast.error("Please write some content first");
      return;
    }

    try {
      toast.info("Improving your writing...");

      const response = await api.post("/ai/improve-writing", {
        content,
      });

      setContent(response.data.improvedContent || content);
      toast.success("Writing improved successfully");
    } catch (error: any) {
      console.error("Error improving writing:", error);
      toast.error(error.response?.data?.message || "Failed to improve writing");
    }
  };

  const handleSave = async () => {
    // Validation
    if (!title.trim()) {
      toast.error("Please enter a document title");
      return;
    }

    if (!content.trim()) {
      toast.error("Please add some content");
      return;
    }

    if (title.length > TITLE_MAX) {
      toast.error(`Title must be ${TITLE_MAX} characters or less`);
      return;
    }

    if (content.length > CONTENT_MAX) {
      toast.error(`Content must be ${CONTENT_MAX} characters or less`);
      return;
    }

    try {
      setSaving(true);

      const documentData = {
        title: title.trim(),
        content: content.trim(),
        summary: summary.trim(),
        tags,
        starred: false,
      };

      const response = await axios.post(
        "http://localhost:2222/create",
        documentData,
        { withCredentials: true }
      );

      toast.success("Document created successfully");

      // Navigate to the document or documents list
      if (response.data.id) {
        navigate(`/editor/${response.data.id}`);
      } else {
        navigate("/documents");
      }
    } catch (error: any) {
      console.error("Error saving document:", error);
      toast.error(error.response?.data?.message || "Failed to save document");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden p-6">
      {/* Background effects */}
      <div className="absolute inset-0 gradient-radial opacity-50" />

      <div className="relative z-10 max-w-7xl mx-auto">
        <Navbar />

        <div className="flex gap-6">
          {/* AI Tools Sidebar */}
          <motion.aside
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card p-6 w-72 h-fit sticky top-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">AI Tools</h3>
            </div>

            <div className="space-y-3">
              <motion.button
                whileHover={{ scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleGenerateTags}
                disabled={generatingTags || !content.trim()}
                className="w-full glass-card px-4 py-3 hover:bg-primary/10 transition-colors rounded-lg text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingTags ? (
                  <Loader2 className="w-4 h-4 animate-spin mb-1" />
                ) : (
                  <>
                    <div className="font-medium mb-1">Generate Tags</div>
                    <div className="text-xs text-muted-foreground">
                      AI-powered categorization
                    </div>
                  </>
                )}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSummarize}
                disabled={summarizing || !content.trim()}
                className="w-full glass-card px-4 py-3 hover:bg-secondary/10 transition-colors rounded-lg text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {summarizing ? (
                  <Loader2 className="w-4 h-4 animate-spin mb-1" />
                ) : (
                  <>
                    <div className="font-medium mb-1">Summarize</div>
                    <div className="text-xs text-muted-foreground">
                      Quick content overview
                    </div>
                  </>
                )}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleImproveWriting}
                disabled={!content.trim()}
                className="w-full glass-card px-4 py-3 hover:bg-accent/10 transition-colors rounded-lg text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="font-medium mb-1">Improve Writing</div>
                <div className="text-xs text-muted-foreground">
                  Enhance clarity & tone
                </div>
              </motion.button>
            </div>

            {/* Character count */}
            <div className="mt-6 pt-6 border-t border-white/10">
              <div className="text-sm text-muted-foreground space-y-2">
                <div className="flex justify-between">
                  <span>Title:</span>
                  <span
                    className={
                      title.length > TITLE_MAX ? "text-destructive" : ""
                    }
                  >
                    {title.length}/{TITLE_MAX}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Content:</span>
                  <span
                    className={
                      content.length > CONTENT_MAX ? "text-destructive" : ""
                    }
                  >
                    {content.length}/{CONTENT_MAX}
                  </span>
                </div>
              </div>
            </div>
          </motion.aside>

          {/* Main Editor */}
          <main className="flex-1">
            <GlassCard className="min-h-[calc(100vh-140px)]">
              {/* Editor Header */}
              <div className="flex items-center justify-between mb-6 pb-6 border-b border-white/10">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Untitled Document"
                    maxLength={TITLE_MAX}
                    className="text-2xl font-bold bg-transparent border-none outline-none focus:ring-0 flex-1"
                  />
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-gradient-purple-blue px-6 py-3 rounded-xl font-semibold flex items-center gap-2 hover:shadow-lg hover:shadow-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Save
                    </>
                  )}
                </motion.button>
              </div>

              {/* Summary */}
              {summary && (
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">
                    Summary
                  </label>
                  <div className="glass-card p-4 rounded-lg">
                    <p className="text-muted-foreground text-sm">{summary}</p>
                  </div>
                </div>
              )}

              {/* Tags Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <TagIcon className="w-4 h-4" />
                  Tags
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Add a tag and press Enter..."
                    className="glass-input flex-1 px-4 py-2 focus:ring-2 focus:ring-ring focus:outline-none transition-all"
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleAddTag}
                    className="glass-card px-4 py-2 hover:bg-primary/10 transition-colors rounded-lg"
                  >
                    Add
                  </motion.button>
                </div>

                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, index) => (
                      <motion.span
                        key={index}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="px-3 py-1 bg-primary/20 text-primary rounded-lg text-sm font-medium flex items-center gap-2 group"
                      >
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(index)}
                          className="hover:text-destructive transition-colors"
                        >
                          ×
                        </button>
                      </motion.span>
                    ))}
                  </div>
                )}
              </div>

              {/* Rich Text Editor Area */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Content
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Start writing your document..."
                  maxLength={CONTENT_MAX}
                  className="w-full min-h-[500px] glass-input px-4 py-3 bg-transparent border-none outline-none resize-none focus:ring-2 focus:ring-ring transition-all"
                />
              </div>
            </GlassCard>
          </main>
        </div>
      </div>
    </div>
  );
}
