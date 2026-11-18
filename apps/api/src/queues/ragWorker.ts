import { Worker, type Job } from "bullmq";
import { embed } from "../lib/ai.js";
import { logger } from "../lib/logger.js";
import { getRedis } from "../lib/redis.js";
import { storage } from "../lib/storage.js";
import { RagChunk } from "../models/ragChunk.js";
import { RagDocument } from "../models/ragDocument.js";
import { chunkText, extractText } from "../modules/knowledge/ingest.js";
import { RAG_QUEUE, type IngestJob } from "./ragQueue.js";

const log = logger.child({ queue: RAG_QUEUE });

export const processIngestJob = async (job: Job<IngestJob>) => {
  const { documentId, storagePath, mimeType } = job.data;

  const doc = await RagDocument.findByIdAndUpdate(documentId, { ragStatus: "processing" }, { new: true });
  if (!doc) return { skipped: "document deleted" };

  // A retry must start clean, or failed attempts leave duplicate chunks behind.
  await RagChunk.deleteMany({ documentId });

  const text = await extractText(await storage.download(storagePath), mimeType);
  if (!text.trim()) throw new Error("No readable text found (scanned PDFs are not supported yet)");

  const chunks = chunkText(text);
  const embeddings = await embed(chunks);

  await RagChunk.insertMany(
    chunks.map((chunk, index) => ({
      documentId,
      teamId: doc.teamId,
      chunkIndex: index,
      text: chunk,
      embedding: embeddings[index],
    })),
  );

  await RagDocument.findByIdAndUpdate(documentId, { ragStatus: "ready" });
  log.info({ jobId: job.id, documentId, chars: text.length, chunks: chunks.length }, "Indexed document");
  return { textLength: text.length, chunkCount: chunks.length };
};

export const startRagWorker = () => {
  const worker = new Worker<IngestJob>(RAG_QUEUE, processIngestJob, { connection: getRedis() });

  worker.on("failed", async (job, err) => {
    log.error({ jobId: job?.id, err: err.message, attempt: job?.attemptsMade }, "Job failed");
    // Only mark the document failed once BullMQ has used up its retries.
    const attemptsLeft = (job?.opts.attempts ?? 1) - (job?.attemptsMade ?? 0);
    if (job?.data.documentId && attemptsLeft <= 0) {
      await RagDocument.findByIdAndUpdate(job.data.documentId, { ragStatus: "failed" });
    }
  });

  return worker;
};
