import { Worker, type Job } from "bullmq";
import { embed } from "../lib/ai.js";
import { logger } from "../lib/logger.js";
import { getRedis } from "../lib/redis.js";
import { storage } from "../lib/storage.js";
import { RagChunk } from "../models/ragChunk.js";
import { RagDocument } from "../models/ragDocument.js";
import { chunkText, extractText } from "../modules/knowledge/ingest.js";
import { indexChat, indexDoc } from "../modules/knowledge/indexer.js";
import { RAG_QUEUE, type ChatIndexJob, type DocIndexJob, type IngestJob } from "./ragQueue.js";

const log = logger.child({ queue: RAG_QUEUE });

/** Uploaded file -> text -> chunks -> embeddings. */
export const processIngestJob = async (job: Job<IngestJob>) => {
  const { documentId, storagePath, mimeType } = job.data;

  const doc = await RagDocument.findByIdAndUpdate(documentId, { ragStatus: "processing" }, { new: true });
  if (!doc) return { skipped: "document deleted" };

  // A retry must start clean, or failed attempts leave duplicate chunks behind.
  await RagChunk.deleteMany({ $or: [{ documentId }, { sourceType: "file", sourceId: documentId }] });

  const text = await extractText(await storage.download(storagePath), mimeType);
  if (!text.trim()) throw new Error("No readable text found (scanned PDFs are not supported yet)");

  const chunks = chunkText(text);
  const embeddings = await embed(chunks);

  await RagChunk.insertMany(
    chunks.map((chunk, index) => ({
      sourceType: "file",
      sourceId: doc._id,
      documentId: doc._id,
      title: doc.fileName,
      teamId: doc.teamId,
      chunkIndex: index,
      text: chunk,
      embedding: embeddings[index],
    })),
  );

  await RagDocument.findByIdAndUpdate(documentId, { ragStatus: "ready" });
  log.info({ jobId: job.id, documentId, chars: text.length, chunks: chunks.length }, "Indexed file");
  return { textLength: text.length, chunkCount: chunks.length };
};

const route = async (job: Job) => {
  switch (job.name) {
    case "index-doc":
      return indexDoc((job.data as DocIndexJob).docId);
    case "index-chat":
      return indexChat((job.data as ChatIndexJob).conversationId, (job.data as ChatIndexJob).full);
    default:
      return processIngestJob(job as Job<IngestJob>);
  }
};

export const startRagWorker = () => {
  const worker = new Worker(RAG_QUEUE, route, { connection: getRedis(), concurrency: 2 });

  worker.on("failed", async (job, err) => {
    log.error({ jobId: job?.id, name: job?.name, err: err.message, attempt: job?.attemptsMade }, "Job failed");
    // Only mark a file failed once BullMQ has used up its retries.
    const attemptsLeft = (job?.opts.attempts ?? 1) - (job?.attemptsMade ?? 0);
    const documentId = (job?.data as Partial<IngestJob> | undefined)?.documentId;
    if (job?.name === "process-document" && documentId && attemptsLeft <= 0) {
      await RagDocument.findByIdAndUpdate(documentId, { ragStatus: "failed" });
    }
  });

  return worker;
};
