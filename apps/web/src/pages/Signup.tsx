import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
} from "@/components/icons";
import { useState } from "react";
import { useRegister } from "@/api/auth";
import { errorMessage } from "@/lib/api";
import AuthShell from "@/components/AuthShell";
import GoogleButton from "@/components/GoogleButton";
import { nextPath } from "@/lib/nextPath";
import { HoverBorderGradient } from "@/components/ace/hover-border-gradient";

export default function Signup() {
  const navigate = useNavigate();
  const register = useRegister();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const isLoading = register.isPending;
  const [error, setError] = useState<string | null>(null);

  const fullName = name.trim();
  const next = nextPath();

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    register.mutate(
      { fullName, email, password },
      {
        // New accounts have no workspace yet: onboarding, unless they came from an invite.
        onSuccess: () => navigate(next ?? "/onboarding"),
        onError: (err) => setError(errorMessage(err, "Failed to create account. Please try again.")),
      },
    );
  };


  return (
    <AuthShell>
      <div className="mb-8 flex flex-col items-center text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Start collaborating with your team today
        </p>
      </div>

      <div className="glass-card p-6 shadow-2xl">
        <GoogleButton />
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 flex items-start gap-3 overflow-hidden rounded-lg border border-red-500/20 bg-red-500/10 p-3"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <p className="text-sm text-red-200">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              Full Name
            </label>
            <div className="group relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-zinc-950/50 py-2 pl-10 pr-4 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                placeholder="John Doe"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              Email
            </label>
            <div className="group relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-zinc-950/50 py-2 pl-10 pr-4 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                placeholder="name@company.com"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              Password
            </label>
            <div className="group relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-zinc-950/50 py-2 pl-10 pr-10 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                placeholder="••••••••"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-zinc-500 transition-colors hover:text-white focus:outline-none"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-zinc-500">
              8+ characters, with at least one letter and one number
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            <HoverBorderGradient
              as="span"
              containerClassName="w-full"
              className="flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                <>
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </HoverBorderGradient>
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link
          to={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="font-medium text-emerald-400 transition-colors hover:text-emerald-300"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
