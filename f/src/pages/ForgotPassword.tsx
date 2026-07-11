import { Link, useNavigate } from "react-router-dom";
import {
  Mail,
  Lock,
  Hash,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
} from "@/components/icons";
import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import AuthShell from "@/components/AuthShell";
import { HoverBorderGradient } from "@/components/ace/hover-border-gradient";

export default function ForgotPassword() {
  const backendURL = import.meta.env.VITE_BACKEND_URL;
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleTeamCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*$/.test(value) && value.length <= 8) {
      setTeamCode(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await axios.post(`${backendURL}/api/auth/reset-password`, {
        email,
        teamCode,
        newPassword,
      });
      toast.success("Password reset successfully. Please sign in.");
      navigate("/login");
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          "Failed to reset password. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="mb-8 flex flex-col items-center text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Reset your password
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Confirm your email and team code to set a new password
        </p>
      </div>

      <div className="glass-card p-6 shadow-2xl">
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
              Team Code
            </label>
            <div className="group relative">
              <Hash className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <input
                type="text"
                inputMode="numeric"
                value={teamCode}
                onChange={handleTeamCodeChange}
                className="w-full rounded-lg border border-white/10 bg-zinc-950/50 py-2 pl-10 pr-4 font-mono text-sm tracking-widest text-white outline-none transition-all placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                placeholder="00000000"
                minLength={8}
                maxLength={8}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              New Password
            </label>
            <div className="group relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-zinc-950/50 py-2 pl-10 pr-10 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                placeholder="••••••••"
                required
                minLength={6}
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
          </div>

          <button type="submit" disabled={loading} className="w-full">
            <HoverBorderGradient
              as="span"
              containerClassName="w-full"
              className="flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Resetting…
                </>
              ) : (
                <>
                  Reset Password
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </HoverBorderGradient>
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Remembered your password?{" "}
        <Link
          to="/login"
          className="font-medium text-emerald-400 transition-colors hover:text-emerald-300"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
