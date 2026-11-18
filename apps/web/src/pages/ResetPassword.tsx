import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Lock, ArrowRight, Loader2, Eye, EyeOff, AlertCircle } from "@/components/icons";
import { useState } from "react";
import { useResetPassword } from "@/api/auth";
import { errorMessage } from "@/lib/api";
import { toast } from "sonner";
import AuthShell from "@/components/AuthShell";
import { HoverBorderGradient } from "@/components/ace/hover-border-gradient";

export default function ResetPassword() {
  const reset = useResetPassword();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const loading = reset.isPending;
  const [error, setError] = useState(token ? "" : "This reset link is missing its token.");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    reset.mutate(
      { token, newPassword },
      {
        onSuccess: () => {
          toast.success("Password updated. Please sign in.");
          navigate("/login", { replace: true });
        },
        onError: (err) => setError(errorMessage(err, "Failed to reset password. Please try again.")),
      },
    );
  };

  const inputClass =
    "w-full rounded-lg border border-white/10 bg-zinc-950/50 py-2 pl-10 pr-10 text-sm text-white outline-none transition-all placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50";

  return (
    <AuthShell>
      <div className="mb-8 flex flex-col items-center text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white">Choose a new password</h1>
        <p className="mt-2 text-sm text-zinc-400">
          8+ characters, with at least one letter and one number
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
              New password
            </label>
            <div className="group relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-2.5 text-zinc-500 transition-colors hover:text-white focus:outline-none"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              Confirm password
            </label>
            <div className="group relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
          </div>

          <button type="submit" disabled={loading || !token} className="w-full disabled:opacity-60">
            <HoverBorderGradient
              as="span"
              containerClassName="w-full"
              className="flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  Set new password
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </HoverBorderGradient>
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Link expired?{" "}
        <Link
          to="/forgot-password"
          className="font-medium text-emerald-400 transition-colors hover:text-emerald-300"
        >
          Send a new one
        </Link>
      </p>
    </AuthShell>
  );
}
