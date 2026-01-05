import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { 
  FileText, 
  Mail, 
  Calendar, 
  Loader2,
  Hash,
  Clock,
  Star,
  ChevronRight
} from "lucide-react";
import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// --- Types ---
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // 1. Fetch Profile
        const profileRes = await axios.get("/api/profile", {
            withCredentials: true 
        });
        setProfile(profileRes.data);

        // 2. Fetch User's Documents
        const docsRes = await axios.get("/api/viewdocs", {
            withCredentials: true
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
  };

  if (loading) {
    return (
        <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-zinc-800">
      <div className="max-w-[1600px] mx-auto min-h-screen flex flex-col">
       
        <div className="flex flex-1 gap-6 min-h-0 mt-4 p-4 md:p-0">
         

          <main className="flex-1 w-full max-w-5xl mx-auto">
            
            {/* --- Profile Header --- */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-10"
            >
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6 p-8 bg-zinc-900/50 border border-zinc-800 rounded-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-800/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                <div className="relative z-10">
                  <div className="w-24 h-24 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-3xl font-bold text-zinc-300 shadow-xl">
                    {profile?.fullName?.charAt(0) || "U"}
                  </div>
                </div>
                
                <div className="flex-1 text-center md:text-left relative z-10 pt-2">
                  <h1 className="text-3xl font-bold text-white mb-2">{profile?.fullName}</h1>
                  
                  <div className="flex flex-wrap gap-4 justify-center md:justify-start text-sm mt-3">
                    <div className="flex items-center gap-2 text-zinc-400 bg-zinc-900/50 px-3 py-1.5 rounded-full border border-zinc-800">
                      <Mail className="w-3.5 h-3.5" />
                      <span>{profile?.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-400 bg-zinc-900/50 px-3 py-1.5 rounded-full border border-zinc-800">
                      <Hash className="w-3.5 h-3.5" />
                      <span className="font-mono">{profile?.teamCode}</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-400 bg-zinc-900/50 px-3 py-1.5 rounded-full border border-zinc-800">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Joined {new Date(profile?.createdAt || "").getFullYear()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* --- Documents Section --- */}
            <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-zinc-500" />
                    My Documents
                </h2>
                <span className="text-sm text-zinc-500">{documents.length} files</span>
            </div>

            {documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-xl">
                    <FileText className="w-12 h-12 text-zinc-700 mb-4" />
                    <p className="text-zinc-500">You haven't created any documents yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {documents.map((doc, i) => (
                        <motion.div
                            key={doc._id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            onClick={() => navigate(`/editor/${doc._id}`)}
                            className="group bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 p-5 rounded-xl cursor-pointer transition-all duration-200 flex flex-col h-[180px]"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="p-2 bg-zinc-800 rounded-lg group-hover:bg-zinc-800/80 transition-colors border border-zinc-700/50">
                                    <FileText className="w-5 h-5 text-zinc-400 group-hover:text-white" />
                                </div>
                                {doc.starred && (
                                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                )}
                            </div>

                            <div className="flex-1 min-h-0">
                                <h3 className="font-semibold text-zinc-200 group-hover:text-white mb-2 truncate">
                                    {doc.title || "Untitled Document"}
                                </h3>
                                {/* STRICT REQUIREMENT: 
                                    Only show summary. If no summary, show nothing.
                                    Removed fallback to doc.content.
                                */}
                                <p className="text-sm text-zinc-500 line-clamp-2 leading-relaxed h-[40px]">
                                    {doc.summary ? doc.summary : ""}
                                </p>
                            </div>

                            <div className="mt-4 pt-4 border-t border-zinc-800/50 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs text-zinc-500">
                                    <Clock className="w-3 h-3" />
                                    <span>Updated {formatDate(doc.updatedAt)}</span>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs text-zinc-400 font-medium">
                                    Open <ChevronRight className="w-3 h-3" />
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