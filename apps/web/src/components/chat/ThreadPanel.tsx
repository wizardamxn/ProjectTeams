import { Tip } from "@/components/ui/tooltip";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { FileText, Loader2, X } from "@/components/icons";
import { useThreadToDoc } from "@/api/ai";
import { errorMessage } from "@/lib/api";
import { useThread } from "@/api/chat";
import type { Person } from "@/api/types";
import { Composer } from "./Composer";
import { MessageItem } from "./MessageItem";
import { isCompact } from "./format";

interface Props {
  conversationId: string;
  rootId: string;
  title: string;
  myId?: string;
  isAdmin: boolean;
  people: Map<string, Person>;
  mentionable: Person[];
  onClose: () => void;
}

/** Side panel (full screen on phones) with a thread's root message, its replies and a reply box. */
export function ThreadPanel({ conversationId, rootId, title, myId, isAdmin, people, mentionable, onClose }: Props) {
  const { data, isLoading, isError } = useThread(conversationId, rootId);
  const end = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const toDoc = useThreadToDoc();

  const makeDoc = () =>
    toDoc.mutate(
      { conversationId, rootId },
      {
        onSuccess: (doc) =>
          toast.success(`Created "${doc.title}"`, { action: { label: "Open", onClick: () => navigate(`/editor/${doc._id}`) } }),
        onError: (err) => toast.error(errorMessage(err, "Couldn't create a doc from this thread")),
      },
    );

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [data?.replies.length]);

  return (
    <aside className="fixed inset-0 z-40 flex flex-col bg-zinc-950 md:static md:z-auto md:w-[380px] md:shrink-0 md:border-l md:border-white/[0.06]">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] px-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-zinc-100">Thread</h2>
          <p className="truncate text-xs text-zinc-500">{title}</p>
        </div>
        <div className="flex items-center gap-1">
          {data && !data.root.deleted && (
            <Tip label="Write a doc from this thread with AI"><button
              onClick={makeDoc}
              disabled={toDoc.isPending}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-60"
            >
              {toDoc.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />} Turn into doc
            </button></Tip>
          )}
          <button onClick={onClose} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label="Close thread">
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto py-2">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
          </div>
        ) : isError || !data ? (
          <p className="px-4 py-10 text-center text-sm text-zinc-500">This thread isn't available.</p>
        ) : (
          <>
            <MessageItem message={data.root} compact={false} myId={myId} isAdmin={isAdmin} people={people} />
            <div className="my-3 flex items-center gap-3 px-4">
              <span className="text-[11px] font-medium text-zinc-500">
                {data.replies.length} {data.replies.length === 1 ? "reply" : "replies"}
              </span>
              <span className="h-px flex-1 bg-white/[0.06]" />
            </div>
            {data.replies.map((r, i) => (
              <MessageItem
                key={r._id}
                message={r}
                compact={isCompact(r, data.replies[i - 1])}
                myId={myId}
                isAdmin={isAdmin}
                people={people}
              />
            ))}
            <div ref={end} />
          </>
        )}
      </div>

      {data && !data.root.deleted && (
        <div className="shrink-0 border-t border-white/[0.06] p-3">
          <Composer conversationId={conversationId} threadRootId={rootId} placeholder="Reply…" people={mentionable} autoFocus />
        </div>
      )}
    </aside>
  );
}
