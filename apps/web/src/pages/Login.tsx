import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from "@/components/icons";
import { useEffect, useState } from "react";
import { useAppSelector } from "@/store/hooks";
import { useLogin } from "@/api/auth";
import { errorMessage } from "@/lib/api";
import AuthShell from "@/components/AuthShell";
import GoogleButton from "@/components/GoogleButton";
import { nextPath } from "@/lib/nextPath";
import { HoverBorderGradient } from "@/components/ace/hover-border-gradient";

export default function Login() {
  const navigate = useNavigate();
  const login = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const loading = login.isPending;
  const next = nextPath();
  const [error, setError] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("expired")) return "Your session expired. Please sign in again.";
    if (params.get("error")?.startsWith("google")) return "Google sign-in didn't work. Please try again.";
    return "";
  });

  const user = useAppSelector((s) => s.user.user);
  const isAuthChecking = useAppSelector((s) => s.user.isAuthChecking);

  useEffect(() => {
    if (!isAuthChecking && user) {
      navigate(next ?? "/dashboard", { replace: true });
    }
  }, [user, isAuthChecking, navigate, next]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    login.mutate(
      { email, password },
      {
        onSuccess: () => navigate(next ?? "/dashboard", { replace: true }),
        onError: (err) => setError(errorMessage(err, "Invalid credentials. Please try again.")),
      },
    );
  };

  return (
    <AuthShell>
      {/* Brand Header */}
      <div className="mb-8 flex flex-col items-center text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Sign in to your workspace to keep collaborating
        </p>
      </div>

      {/* Card */}
      <div className="glass-card p-6 shadow-2xl">
        <GoogleButton />
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="text-xs font-medium uppercase tracking-wider text-zinc-400"
            >
              Email
            </label>
            <div className="group relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <input
                id="email"
                type="email"
                name="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-zinc-950/50 py-2 pl-10 pr-4 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                placeholder="name@company.com"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="text-xs font-medium uppercase tracking-wider text-zinc-400"
              >
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs text-emerald-400/80 transition-colors hover:text-emerald-300"
              >
                Forgot?
              </Link>
            </div>
            <div className="group relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <input
                id="password"
                name="password"
                autoComplete="current-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-zinc-950/50 py-2 pl-10 pr-10 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-zinc-500 transition-colors hover:text-white focus:outline-none"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
              {error}
            </motion.div>
          )}

          <button type="submit" disabled={loading} className="w-full">
            <HoverBorderGradient
              as="span"
              containerClassName="w-full"
              className="flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </HoverBorderGradient>
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Don't have an account?{" "}
        <Link
          to={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
          className="font-medium text-emerald-400 transition-colors hover:text-emerald-300"
        >
          Sign up
        </Link>
      </p>
    </AuthShell>
  );
}
