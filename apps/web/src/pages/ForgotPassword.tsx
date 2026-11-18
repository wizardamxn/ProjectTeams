import { Link } from "react-router-dom";
import { Mail, ArrowRight, Loader2, AlertCircle, Check } from "@/components/icons";
import { useState } from "react";
import { useForgotPassword } from "@/api/auth";
import { errorMessage } from "@/lib/api";
import AuthShell from "@/components/AuthShell";
import { HoverBorderGradient } from "@/components/ace/hover-border-gradient";

export default function ForgotPassword() {
  const forgot = useForgotPassword();
  const [email, setEmail] = useState("");
  const loading = forgot.isPending;
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    forgot.mutate(email, {
      onSuccess: () => setSent(true),
      onError: (err) => setError(errorMessage(err)),
    });
  };

  return (
    <AuthShell>
      <div className="mb-8 flex flex-col items-center text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Reset your password
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          We'll email you a link to set a new password
        </p>
      </div>

      <div className="glass-card p-6 shadow-2xl">
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15">
              <Check className="h-5 w-5 text-emerald-400" />
            </div>
            <p className="text-sm text-zinc-200">
              If an account exists for <span className="font-medium">{email}</span>,
              a reset link is on its way. It works for 30 minutes.
            </p>
            <p className="text-xs text-zinc-500">Check your spam folder if it doesn't arrive.</p>
          </div>
        ) : (
          <>
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

              <button type="submit" disabled={loading} className="w-full">
                <HoverBorderGradient
                  as="span"
                  containerClassName="w-full"
                  className="flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      Send reset link
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </HoverBorderGradient>
              </button>
            </form>
          </>
        )}
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
