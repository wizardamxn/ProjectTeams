import { Worker } from "bullmq";
import { PDFParse } from "pdf-parse";
import connection from "./connection.js";
import supabase from "../utils/supabase.js";
import RagDocument from "../models/ragDocument.js";
import RagChunk from "../models/ragChunk.js";
import { chunkText } from "../utils/chunkText.js";
import { embedChunks } from "../utils/embedChunks.js";

const BUCKET = process.env.SUPABASE_BUCKET;

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

    const chunks = chunkText(text, { chunkSize: 1000, overlap: 150 });
    console.log(
      `[rag-processing] Split into ${chunks.length} chunks from ${storagePath}`,
    );

    const embeddings = await embedChunks(chunks);
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
  if (job?.data?.documentId) {
    await RagDocument.findByIdAndUpdate(job.data.documentId, {
      ragStatus: "failed",
    });
  }
});

export default ragWorker;
