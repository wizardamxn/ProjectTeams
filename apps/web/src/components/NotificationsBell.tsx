import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Bell, Check, Loader2 } from "@/components/icons";
import { useMarkNotificationsRead, useNotifications } from "@/api/chat";
import { Avatar } from "@/components/chat/Avatar";
import { formatRelativeTime } from "@/lib/format";

const GAP = 8;
const EDGE = 16; // keep this far from the viewport edges

/**
 * Where the panel goes, from the bell's position on screen:
 * - "side": to the right of the desktop rail, bottom edges aligned (grows upward)
 * - "below": under the bell, right edges aligned (mobile top bar)
 * The panel is portaled to <body>, so the sidebar can't clip or cover it.
 */
const panelPosition = (rect: DOMRect, placement: "side" | "below"): CSSProperties => {
  const width = Math.min(320, window.innerWidth - EDGE * 2);
  if (placement === "side") {
    return {
      width,
      left: Math.min(rect.right + GAP, window.innerWidth - width - EDGE),
      bottom: Math.max(window.innerHeight - rect.bottom, EDGE),
      maxHeight: rect.bottom - EDGE,
    };
  }
  return {
    width,
    top: rect.bottom + GAP,
    left: Math.max(EDGE, Math.min(rect.right - width, window.innerWidth - width - EDGE)),
    maxHeight: window.innerHeight - rect.bottom - GAP - EDGE,
  };
};

/** Bell with an unread count; the menu lists mentions and thread replies. */
export default function NotificationsBell({ label, placement = "side" }: { label?: React.ReactNode; placement?: "side" | "below" }) {
  const navigate = useNavigate();
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const unread = data?.unread ?? 0;

  // Layout effect: position is computed before the first paint, so the panel never flashes in the corner.
  useLayoutEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!buttonRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    // Follow the bell every frame while open: the rail animates its width on hover.
    let frame = 0;
    let last = "";
    const track = () => {
      if (buttonRef.current) {
        const next = panelPosition(buttonRef.current.getBoundingClientRect(), placement);
        const key = JSON.stringify(next);
        if (key !== last) setStyle(next); // re-render only when it actually moved
        last = key;
      }
      frame = requestAnimationFrame(track);
    };
    track();
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open, placement]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
      >
        <span className="relative">
          <Bell className="h-5 w-5 shrink-0" />
          {unread > 0 && (
            <span className="absolute -right-1.5 -top-1.5 min-w-[1rem] rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-4 text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </span>
        {label}
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications"
          style={{ ...style, maxHeight: Math.min(Number(style.maxHeight ?? 448), 448) }}
          className="fixed z-[60] flex flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
            <span className="text-sm font-semibold text-zinc-100">Notifications</span>
            {unread > 0 && (
              <button onClick={() => markRead.mutate(undefined)} className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300">
                <Check className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
          <ul className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
            {isLoading && <li className="py-6"><Loader2 className="mx-auto h-4 w-4 animate-spin text-zinc-500" /></li>}
            {!isLoading && (data?.items.length ?? 0) === 0 && (
              <li className="px-4 py-8 text-center text-sm text-zinc-500">You're all caught up. Mentions, replies and doc comments show up here.</li>
            )}
            {data?.items.map((n) => (
              <li key={n._id}>
                <button
                  onClick={() => {
                    setOpen(false);
                    if (!n.read) markRead.mutate([n._id]);
                    navigate(
                      n.type === "doc_comment"
                        ? `/editor/${n.docId}?comment=${n.commentId}`
                        : `/chat/${n.conversationId}${n.threadRootId ? `?thread=${n.threadRootId}` : ""}`,
                    );
                  }}
                  className={`flex w-full gap-3 px-3 py-2.5 text-left hover:bg-white/[0.04] ${n.read ? "" : "bg-emerald-500/[0.05]"}`}
                >
                  <Avatar person={n.actor} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-zinc-400">
                      <span className="font-semibold text-zinc-100">{n.actor.fullName}</span>{" "}
                      {n.type === "mention" ? "mentioned you in" : n.type === "doc_comment" ? "commented on" : "replied in a thread in"} {n.conversationName}
                    </span>
                    {n.preview && <span className="mt-0.5 line-clamp-2 block text-sm text-zinc-300">{n.preview}</span>}
                    <span className="mt-0.5 block text-[11px] text-zinc-500">{formatRelativeTime(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />}
                </button>
              </li>
            ))}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}
