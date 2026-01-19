import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import {
  FileText,
  Mail,
  Lock,
  User,
  ArrowRight,
  Hash,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";
import axios from "axios";
import { useDispatch } from "react-redux";
import { addUser, logout } from "@/store/slices/User";

export default function Signup() {
  const backendURL = import.meta.env.VITE_BACKEND_URL;

  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [teamCode, setTeamCode] = useState("");

  // UI State
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullName = name.trim();
  const isTeamCodeValid = teamCode.length === 8;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTeamCodeValid) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await axios.post(
        `${backendURL}/register`,
        { fullName, email, password, teamCode },
        { withCredentials: true },
      );

      const me = await axios.get(`${backendURL}/profile`, {
        withCredentials: true,
      });

      dispatch(addUser(me.data));
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Signup failed:", error);
      // specific error message from backend or fallback
      setError(
        error.response?.data?.message ||
          "Failed to create account. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to enforce 8-digit number format
  const handleTeamCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers and max 8 characters
    if (/^\d*$/.test(value) && value.length <= 8) {
      setTeamCode(value);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4 font-sans selection:bg-zinc-800">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[400px]"
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center mb-4 shadow-sm group">
            <FileText className="w-6 h-6 text-zinc-400 group-hover:text-zinc-100 transition-colors" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Create an account
          </h1>
          <p className="text-sm text-zinc-400 mt-2">
            Start collaborating with your team today
          </p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 shadow-xl backdrop-blur-sm">
          {/* Error Message Alert */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, mb: 0 }}
                animate={{ opacity: 1, height: "auto", mb: 16 }}
                exit={{ opacity: 0, height: 0, mb: 0 }}
                className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-3 overflow-hidden"
              >
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-200">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSignup} className="space-y-4">
            {/* Name Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Full Name
              </label>
              <div className="relative group">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-950/50 border border-zinc-800 focus:border-zinc-600 rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 outline-none transition-all"
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>

            {/* Email Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Email
              </label>
              <div className="relative group">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-950/50 border border-zinc-800 focus:border-zinc-600 rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 outline-none transition-all"
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>

            {/* Password Input (Updated with Toggle) */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Password
              </label>
              <div className="relative group">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  // Added pr-10 to prevent text overlapping the eye icon
                  className="w-full bg-zinc-950/50 border border-zinc-800 focus:border-zinc-600 rounded-lg py-2 pl-10 pr-10 text-sm text-white placeholder:text-zinc-600 outline-none transition-all"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-zinc-500 hover:text-white transition-colors focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Team Code Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider flex justify-between items-center">
                <span>Team Code</span>
                <span
                  className={`text-[10px] ${isTeamCodeValid ? "text-green-500" : "text-zinc-600"}`}
                >
                  {teamCode.length}/8 digits
                </span>
              </label>
              <div className="relative group">
                <Hash className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors" />
                <input
                  type="text"
                  inputMode="numeric"
                  value={teamCode}
                  onChange={handleTeamCodeChange}
                  className={`w-full bg-zinc-950/50 border focus:border-zinc-600 rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 outline-none transition-all font-mono tracking-widest
                    ${isTeamCodeValid ? "border-zinc-800" : "border-zinc-800 focus:border-red-900/50"}
                  `}
                  placeholder="00000000"
                  minLength={8}
                  maxLength={8}
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !isTeamCodeValid}
              className={`
                w-full font-medium py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 mt-2
                ${
                  isLoading || !isTeamCodeValid
                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                    : "bg-zinc-100 hover:bg-white text-zinc-950"
                }
              `}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-zinc-500 mt-6">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-zinc-200 hover:text-white font-medium transition-colors"
          >
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
