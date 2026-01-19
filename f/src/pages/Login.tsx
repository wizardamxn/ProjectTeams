import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import {
  FileText,
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useEffect, useState } from "react";
import axios from "axios";
import { useDispatch, useSelector, useStore } from "react-redux";
import { addUser } from "@/store/slices/User";

export default function Login() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const backendURL = import.meta.env.VITE_BACKEND_URL;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); // New state for toggle
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const user = useSelector((s) => s.user.user);
  const isAuthChecking = useSelector((s) => s.user.isAuthChecking);

  useEffect(() => {
    if (!isAuthChecking && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, isAuthChecking, navigate]);
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Logic Improvement: Basic client-side validation
    if (!email || !password) {
      setError("Please enter both email and password.");
      setLoading(false);
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email address.");
      setLoading(false);
      return;
    }

    try {
      const res = await axios.post(
        `${backendURL}/login`,
        { email, password },
        { withCredentials: true },
      );

      dispatch(addUser(res.data));
      navigate("/dashboard");
    } catch (err: any) {
      console.error(err);
      setError(
        err.response?.data?.message || "Invalid credentials. Please try again.",
      );
    } finally {
      setLoading(false);
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
          <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center mb-4 shadow-sm group hover:border-zinc-700 transition-colors">
            <FileText className="w-6 h-6 text-zinc-100 group-hover:scale-110 transition-transform duration-300" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Welcome back
          </h1>
          <p className="text-sm text-zinc-400 mt-2">
            Enter your credentials to access your workspace
          </p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 shadow-xl backdrop-blur-sm">
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email Input */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-xs font-medium text-zinc-400 uppercase tracking-wider"
              >
                Email
              </label>
              <div className="relative group">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors" />
                <input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="username" // UX: Helps password managers
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-950/50 border border-zinc-800 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 outline-none transition-all"
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-xs font-medium text-zinc-400 uppercase tracking-wider"
                >
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative group">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors" />
                <input
                  id="password"
                  name="password"
                  autoComplete="current-password" // UX: Helps password managers
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-950/50 border border-zinc-800 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 rounded-lg py-2 pl-10 pr-10 text-sm text-white placeholder:text-zinc-600 outline-none transition-all"
                  placeholder="••••••••"
                  required
                />

                {/* Toggle Visibility Button */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-zinc-500 hover:text-white transition-colors focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                {error}
              </motion.div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-zinc-100 hover:bg-white active:scale-[0.98] text-zinc-950 font-medium py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2 shadow-lg shadow-zinc-950/20"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-zinc-500 mt-6">
          Don't have an account?{" "}
          <Link
            to="/signup"
            className="text-zinc-200 hover:text-white font-medium transition-colors"
          >
            Sign up
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
