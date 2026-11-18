import { Queue } from "bullmq";
import { config } from "../config.js";
import { getRedis } from "../lib/redis.js";

export const RAG_QUEUE = "rag-processing";

/** An uploaded file to extract, chunk and embed. */
export interface IngestJob {
  documentId: string;
  storagePath: string;
  mimeType: string;
}
/** A written doc to (re)index. */
export interface DocIndexJob {
  docId: string;
}
/** A public channel to index: new messages only, or everything again after an edit/delete. */
export interface ChatIndexJob {
  conversationId: string;
  full: boolean;
}

type AnyJob = IngestJob | DocIndexJob | ChatIndexJob;

let queue: Queue<AnyJob> | undefined;

const getQueue = (): Queue<AnyJob> | { add: () => Promise<null> } => {
  if (config.QUEUE_DISABLED) return { add: async () => null };
  queue ??= new Queue<AnyJob>(RAG_QUEUE, { connection: getRedis() });
  return queue;
};

const retry = { attempts: 3, backoff: { type: "exponential", delay: 5000 }, removeOnComplete: true, removeOnFail: 500 } as const;

export const enqueueIngest = (job: IngestJob) => getQueue().add("process-document", job, retry);

/**
 * Docs are indexed a little after the last edit. A pending job with the same id
 * absorbs further edits, so autosave doesn't re-embed on every keystroke.
 */
export const enqueueDocIndex = (docId: string, delayMs = 30_000) =>
  getQueue().add("index-doc", { docId }, { ...retry, jobId: `doc-${docId}`, delay: delayMs });

export const enqueueChatIndex = (conversationId: string, full = false, delayMs = 60_000) =>
  getQueue().add(
    "index-chat",
    { conversationId, full },
    { ...retry, jobId: `chat-${conversationId}${full ? "-full" : ""}`, delay: delayMs },
  );
