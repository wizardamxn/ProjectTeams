import { Queue } from "bullmq";
import { getRedis } from "../lib/redis.js";

export const RAG_QUEUE = "rag-processing";

export interface IngestJob {
  documentId: string;
  storagePath: string;
  mimeType: string;
}

let queue: Queue<IngestJob> | undefined;

const getQueue = (): Queue<IngestJob> => {
  queue ??= new Queue<IngestJob>(RAG_QUEUE, { connection: getRedis() });
  return queue;
};

export const enqueueIngest = (job: IngestJob) =>
  getQueue().add("process-document", job, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  });
