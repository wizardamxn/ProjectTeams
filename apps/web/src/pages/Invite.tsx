import { useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { AlertCircle, ArrowRight, Building, Loader2, Users } from "@/components/icons";
import AuthShell from "@/components/AuthShell";
import { useAcceptInvite, useInvitePreview } from "@/api/workspaces";
import { errorMessage } from "@/lib/api";
import { useAppSelector } from "@/store/hooks";

/**
 * /invite/:token — what an invite link opens. Signed-in users join with one
 * click (or automatically when they just signed in to accept it); everyone
 * else is sent to sign up or log in and brought back here.
 */
export default function InvitePage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { user, isAuthChecking } = useAppSelector((s) => s.user);
  const preview = useInvitePreview(token);
  const accept = useAcceptInvite();

  const join = () =>
    accept.mutate(token, {
      onSuccess: (res) => {
        toast.success(res.alreadyMember ? `Switched to ${res.workspace.name}` : `Welcome to ${res.workspace.name}`);
        navigate("/dashboard", { replace: true });
      },
    });

  // Coming back from login/signup/Google with ?accept=1: join without another click.
  const autoTried = useRef(false);
  useEffect(() => {
    const wantsAuto = new URLSearchParams(window.location.search).has("accept");
    if (wantsAuto && user && preview.data && !autoTried.current) {
      autoTried.current = true;
      join();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, preview.data]);

  const back = encodeURIComponent(`/invite/${token}?accept=1`);

  return (
    <AuthShell>
      {preview.isLoading || isAuthChecking ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      ) : preview.isError || !preview.data ? (
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-10 w-10 text-red-400" />
          <h1 className="text-2xl font-bold text-white">This invite doesn't work</h1>
          <p className="mt-2 text-sm text-zinc-400">
            {errorMessage(preview.error, "It may have expired or been revoked.")} Ask the person who invited you for a
            new link.
          </p>
          <Link to={user ? "/dashboard" : "/"} className="mt-6 inline-block text-sm text-emerald-400 hover:text-emerald-300">
            {user ? "Go to your dashboard" : "Go to the home page"} &rarr;
          </Link>
        </div>
      ) : (
        <div>
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-2xl font-bold text-white">
              {preview.data.workspace.name.charAt(0).toUpperCase()}
            </div>
            <p className="text-sm text-zinc-400">
              {preview.data.invitedBy ? `${preview.data.invitedBy} invited you to join` : "You're invited to join"}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">{preview.data.workspace.name}</h1>
            <p className="mt-2 flex items-center justify-center gap-3 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> {preview.data.workspace.memberCount}{" "}
                {preview.data.workspace.memberCount === 1 ? "member" : "members"}
              </span>
              <span className="flex items-center gap-1">
                <Building className="h-3.5 w-3.5" /> as {preview.data.role === "admin" ? "an admin" : "a member"}
              </span>
            </p>
          </div>

          {accept.isError && (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <p className="text-sm text-red-200">{errorMessage(accept.error, "Could not join this workspace.")}</p>
            </div>
          )}

          {user ? (
            <div className="space-y-3">
              <button
                onClick={join}
                disabled={accept.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {accept.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Join {preview.data.workspace.name}
              </button>
              <p className="text-center text-xs text-zinc-500">Signed in as {user.email}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <Link
                to={`/signup?next=${back}`}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Create an account to join <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to={`/login?next=${back}`}
                className="block w-full rounded-lg border border-white/10 bg-zinc-900 py-3 text-center text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
              >
                I already have an account
              </Link>
              {preview.data.emailRestricted && (
                <p className="text-center text-xs text-zinc-500">
                  This invite was sent to a specific email address. Use that address to join.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </AuthShell>
  );
}
