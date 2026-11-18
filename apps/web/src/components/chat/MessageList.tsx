import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Loader2 } from "@/components/icons";
import { useMessages, useTyping } from "@/api/chat";
import type { Person } from "@/api/types";
import { MessageItem } from "./MessageItem";
import { dayLabel, isCompact, isSameDay } from "./format";

interface Props {
  conversationId: string;
  myId?: string;
  isAdmin: boolean;
  people: Map<string, Person>;
  /** Unread count when the conversation was opened; draws the "New" line. */
  unreadAtOpen: number;
  onOpenThread: (rootId: string) => void;
  emptyState: React.ReactNode;
}

export function MessageList({ conversationId, myId, isAdmin, people, unreadAtOpen, onOpenThread, emptyState }: Props) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useMessages(conversationId);
  const typing = useTyping(conversationId);
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const prevHeight = useRef(0);

  // Pages are newest-first; each page is oldest → newest.
  const messages = useMemo(() => (data ? [...data.pages].reverse().flatMap((p) => p.messages) : []), [data]);

  // Where the "New messages" line goes: before the first of the last N messages from others.
  const firstUnreadId = useMemo(() => {
    if (unreadAtOpen <= 0) return null;
    let seen = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]!.sender._id !== myId) seen++;
      if (seen === unreadAtOpen) return messages[i]!._id;
    }
    return null;
    // Only computed once per open, from the first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, unreadAtOpen, messages.length > 0]);

  // Start at the bottom; stay there as messages arrive unless the user scrolled up.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prevHeight.current && !stickToBottom.current) {
      // Older messages were added above: keep the view where it was.
      el.scrollTop += el.scrollHeight - prevHeight.current;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
    prevHeight.current = el.scrollHeight;
  }, [messages, typing.length]);

  useEffect(() => {
    stickToBottom.current = true;
    prevHeight.current = 0;
  }, [conversationId]);

  // Images and files load after the first render and push content down;
  // keep the newest message in view while the user is at the bottom.
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    const inner = content.current;
    if (!el || !inner) return;
    const observer = new ResizeObserver(() => {
      if (stickToBottom.current) el.scrollTop = el.scrollHeight;
      prevHeight.current = el.scrollHeight;
    });
    observer.observe(inner);
    return () => observer.disconnect();
  }, [isLoading]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    prevHeight.current = el.scrollHeight;
    if (el.scrollTop < 200 && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  };

  const othersTyping = typing.filter((t) => t.userId !== myId);

  return (
    <div ref={scroller} onScroll={onScroll} className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain py-3">
      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
        </div>
      ) : (
        <div ref={content}>
          {isFetchingNextPage && (
            <div className="flex justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-600" />
            </div>
          )}
          {!hasNextPage && <div className="px-4 pb-2 pt-6">{emptyState}</div>}

          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const newDay = !prev || !isSameDay(prev.createdAt, m.createdAt);
            return (
              <div key={m._id}>
                {newDay && (
                  <div className="my-4 flex items-center gap-3 px-4" role="separator">
                    <span className="h-px flex-1 bg-white/[0.06]" />
                    <span className="text-[11px] font-medium text-zinc-500">{dayLabel(m.createdAt)}</span>
                    <span className="h-px flex-1 bg-white/[0.06]" />
                  </div>
                )}
                {m._id === firstUnreadId && (
                  <div className="my-2 flex items-center gap-3 px-4" role="separator" aria-label="New messages">
                    <span className="h-px flex-1 bg-red-500/40" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-red-400">New</span>
                  </div>
                )}
                <MessageItem
                  message={m}
                  compact={!newDay && m._id !== firstUnreadId && isCompact(m, prev)}
                  myId={myId}
                  isAdmin={isAdmin}
                  people={people}
                  onOpenThread={onOpenThread}
                />
              </div>
            );
          })}

          <div className="h-5 px-6 pt-1 text-xs text-zinc-500" aria-live="polite">
            {othersTyping.length > 0 &&
              `${othersTyping.map((t) => t.fullName.split(" ")[0]).join(", ")} ${othersTyping.length === 1 ? "is" : "are"} typing…`}
          </div>
        </div>
      )}
    </div>
  );
}
