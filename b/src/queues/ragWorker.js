import { Worker } from "bullmq";
import { PDFParse } from "pdf-parse";
import connection from "./connection.js";
import supabase from "../utils/supabase.js";
import RagDocument from "../models/ragDocument.js";
import RagChunk from "../models/ragChunk.js";
import { chunkText } from "../utils/chunkText.js";
import { embedChunks } from "../utils/embedChunks.js";

const BUCKET = process.env.SUPABASE_BUCKET;
const EMBED_BATCH_SIZE = 100;

const extractText = async (buffer, mimeType) => {
  if (mimeType === "application/pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const { text } = await parser.getText({ pageJoiner: "" });
      return text;
    } finally {
      await parser.destroy();
    }
  }

  if (mimeType.startsWith("text/")) {
    return buffer.toString("utf-8");
  }

  throw new Error(`Unsupported mimeType for text extraction: ${mimeType}`);
};

const ragWorker = new Worker(
  "rag-processing",
  async (job) => {
    const { documentId, storagePath, mimeType } = job.data;

    const ragDocument = await RagDocument.findByIdAndUpdate(
      documentId,
      { ragStatus: "processing" },
      { new: true },
    );
    if (!ragDocument) return { skipped: "document deleted" };

    // A retry must start clean, or failed attempts leave duplicate chunks behind.
    await RagChunk.deleteMany({ documentId });

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(storagePath);
    if (error) {
      throw new Error(`Supabase download failed: ${error.message}`);
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    const text = await extractText(buffer, mimeType);

    console.log(
      `[rag-processing] Extracted ${text.length} chars from ${storagePath}`,
    );

    if (!text || !text.trim()) {
      throw new Error("No readable text found (scanned PDFs are not supported yet)");
    }

    const chunks = chunkText(text, { chunkSize: 1000, overlap: 150 });
    console.log(
      `[rag-processing] Split into ${chunks.length} chunks from ${storagePath}`,
    );

    // Embed in batches so large documents stay under provider request limits.
    const embeddings = [];
    for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
      embeddings.push(...(await embedChunks(chunks.slice(i, i + EMBED_BATCH_SIZE))));
    }
    console.log(
      `[rag-processing] Embedded ${embeddings.length} chunks (dim ${embeddings[0]?.length}) from ${storagePath}`,
    );

    await RagChunk.insertMany(
      chunks.map((chunk, index) => ({
        documentId,
        teamId: ragDocument.teamId,
        chunkIndex: index,
        text: chunk,
        embedding: embeddings[index],
      })),
    );

    await RagDocument.findByIdAndUpdate(documentId, { ragStatus: "ready" });

    return { textLength: text.length, chunkCount: chunks.length };
  },
  { connection },
);

ragWorker.on("completed", (job) => {
  console.log(`[rag-processing] Job ${job.id} completed`);
});

ragWorker.on("failed", async (job, err) => {
  console.error(`[rag-processing] Job ${job?.id} failed:`, err.message);
  // Only mark the document failed once BullMQ has used up its retries.
  const attemptsLeft = (job?.opts?.attempts ?? 1) - (job?.attemptsMade ?? 0);
  if (job?.data?.documentId && attemptsLeft <= 0) {
    await RagDocument.findByIdAndUpdate(job.data.documentId, {
      ragStatus: "failed",
    });
  }
});

export default ragWorker;
