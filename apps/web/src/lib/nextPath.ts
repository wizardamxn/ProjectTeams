/**
 * The `?next=` path to return to after signing in. Only same-site paths are
 * allowed, so a crafted link can't bounce someone to another website.
 */
export const nextPath = (search = window.location.search): string | null => {
  const next = new URLSearchParams(search).get("next");
  return next && /^\/(?!\/)/.test(next) ? next : null;
};

/** The invite token inside a `next` path like /invite/<token>?accept=1, if any. */
export const inviteFromNext = (next: string | null) =>
  next ? (/^\/invite\/([A-Za-z0-9_-]{16,64})/.exec(next)?.[1] ?? undefined) : undefined;
