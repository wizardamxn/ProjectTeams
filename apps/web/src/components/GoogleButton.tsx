import { Google } from "@/components/icons";
import { googleSignInUrl, useAuthProviders } from "@/api/auth";
import { inviteFromNext, nextPath } from "@/lib/nextPath";

/** "Continue with Google", shown only when the server has Google sign-in configured. */
export default function GoogleButton() {
  const { data } = useAuthProviders();
  if (!data?.google) return null;

  const next = nextPath();
  const href = googleSignInUrl({ invite: inviteFromNext(next), next: next ?? undefined });

  return (
    <>
      <a
        href={href}
        className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-white/10 bg-zinc-900 py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-800"
      >
        <Google className="h-4 w-4" />
        Continue with Google
      </a>
      <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-zinc-600">
        <span className="h-px flex-1 bg-white/10" /> or with email <span className="h-px flex-1 bg-white/10" />
      </div>
    </>
  );
}
