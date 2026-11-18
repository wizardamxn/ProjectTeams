import type { Types } from "mongoose";
import { embed, generate } from "../../lib/ai.js";
import { Conversation } from "../../models/conversation.js";
import { Document } from "../../models/document.js";
import type { SourceType } from "../../models/ragChunk.js";
import { conflict, notFound } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { storage } from "../../lib/storage.js";
import { RagChunk } from "../../models/ragChunk.js";
import { RagDocument, type RagDocumentDoc } from "../../models/ragDocument.js";
import type { WorkspaceContext } from "../workspaces/workspaces.service.js";
import { enqueueIngest } from "../../queues/ragQueue.js";
import { safeFileName } from "./ingest.js";
import { auditService } from "../audit/audit.service.js";

export interface RetrievedChunk {
  _id: Types.ObjectId;
  text: string;
  score: number;
  sourceType?: SourceType;
  sourceId?: Types.ObjectId;
  documentId?: Types.ObjectId;
  title?: string;
  messageId?: Types.ObjectId;
}

const ASK_PROMPT = `
You answer questions about a team's work using ONLY the numbered context below
(their docs, uploaded files and public channel messages).
If the answer isn't in the context, say you don't know. Never use outside knowledge.
Cite every fact with the context number(s) in square brackets, like [1] or [2][3].
Be concise: a short paragraph or a few bullets.`;

/** A citation the client can turn into a link. */
export const toSource = (c: RetrievedChunk, n: number) => {
  const type: SourceType = c.sourceType ?? "file";
  const id = (c.sourceId ?? c.documentId)?.toString() ?? null;
  return {
    n,
    type,
    title: c.title ?? (type === "file" ? "Uploaded file" : type === "doc" ? "Document" : "Channel"),
    snippet: c.text.slice(0, 280),
    score: c.score,
    docId: type === "doc" ? id : null,
    fileId: type === "file" ? id : null,
    conversationId: type === "chat" ? id : null,
    messageId: type === "chat" ? (c.messageId?.toString() ?? null) : null,
  };
};

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Replaces the stored path in `fileUrl` with a short-lived signed URL. */
const withSignedUrls = async (docs: RagDocumentDoc[]) => {
  let urls: (string | null)[] = [];
  try {
    urls = await storage.signedUrls(docs.map((d) => d.storagePath));
  } catch (err) {
    logger.error({ err }, "Could not sign file URLs");
  }
  return docs.map((d, i) => ({ ...d.toObject(), fileUrl: urls[i] ?? null }));
};

const getWorkspaceFile = async (ctx: WorkspaceContext, id: string) => {
  const doc = await RagDocument.findOne({ _id: id, teamId: ctx.key });
  if (!doc) throw notFound("Document not found");
  return doc;
};

export const knowledgeService = {
  async upload(ctx: WorkspaceContext, file: UploadedFile) {
    const storagePath = `${ctx.key}/${Date.now()}-${safeFileName(file.originalname)}`;
    await storage.upload(storagePath, file.buffer, file.mimetype);

    const doc = await RagDocument.create({
      fileName: file.originalname.slice(0, 200),
      fileUrl: storagePath,
      storagePath,
      mimeType: file.mimetype,
      fileSize: file.size,
      teamId: ctx.key,
      uploadedBy: ctx.user._id,
    });
    auditService.record(ctx, "file.uploaded", { type: "file", id: doc._id.toString(), label: doc.fileName }, { size: file.size });
    // New files are indexed straight away (the "Index" button is only for retries).
    await this.startIndexing(ctx, doc._id.toString()).catch((err) =>
      logger.warn({ err, documentId: doc._id.toString() }, "Could not queue file indexing"),
    );
    const [signed] = await withSignedUrls([(await RagDocument.findById(doc._id)) ?? doc]);
    return signed;
  },

  async list(ctx: WorkspaceContext) {
    const docs = await RagDocument.find({ teamId: ctx.key }).sort({ createdAt: -1 });
    return withSignedUrls(docs);
  },

  async get(ctx: WorkspaceContext, id: string) {
    const doc = await getWorkspaceFile(ctx, id);
    const chunks = await RagChunk.find({ documentId: doc._id })
      .select("chunkIndex text")
      .sort({ chunkIndex: 1 });
    const [signed] = await withSignedUrls([doc]);
    return { document: signed, chunks };
  },

  async startIndexing(ctx: WorkspaceContext, id: string) {
    const doc = await getWorkspaceFile(ctx, id);
    if (doc.ragStatus === "processing" || doc.ragStatus === "ready") {
      throw conflict(`Document is already ${doc.ragStatus}`);
    }
    // Mark it before queueing so a double click can't queue the same file twice.
    doc.ragStatus = "processing";
    await doc.save();
    try {
      await enqueueIngest({
        documentId: doc._id.toString(),
        storagePath: doc.storagePath,
        mimeType: doc.mimeType,
      });
    } catch (err) {
      doc.ragStatus = "failed";
      await doc.save();
      throw err;
    }
    return doc;
  },

  async remove(ctx: WorkspaceContext, id: string) {
    const doc = await getWorkspaceFile(ctx, id);
    await RagChunk.deleteMany({ $or: [{ documentId: doc._id }, { sourceType: "file", sourceId: doc._id }] });
    await storage.remove(doc.storagePath).catch((err) =>
      logger.error({ err, path: doc.storagePath }, "Could not remove file from storage"),
    );
    await doc.deleteOne();
    auditService.record(ctx, "file.deleted", { type: "file", id: doc._id.toString(), label: doc.fileName });
  },

  /** Nearest chunks to `question`, restricted to the workspace inside the vector index. */
  async search(teamId: string, question: string, limit = 6) {
    const [queryVector] = await embed([question]);
    if (!queryVector) return [];
    return RagChunk.aggregate<RetrievedChunk>([
      {
        $vectorSearch: {
          index: "rag_chunk_vector_index",
          path: "embedding",
          queryVector,
          numCandidates: limit * 10,
          limit,
          filter: { teamId },
        },
      },
      {
        $project: {
          text: 1,
          documentId: 1,
          sourceType: 1,
          sourceId: 1,
          title: 1,
          messageId: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ]);
  },

  /** Answers from the workspace's docs, files and public channels, citing numbered sources. */
  async ask(ctx: WorkspaceContext, question: string) {
    const chunks = await this.search(ctx.key, question, 6);
    if (chunks.length === 0) {
      return {
        answer: "I couldn't find anything about that in this workspace yet. Write a doc, upload a file, or talk about it in a public channel, and I'll be able to answer from it.",
        sources: [],
      };
    }

    const sources = chunks.map((c, i) => toSource(c, i + 1));
    const context = chunks.map((c, i) => `[${i + 1}] (${sources[i]!.type}: ${sources[i]!.title}) ${c.text}`).join("\n\n");
    const answer = await generate({
      system: ASK_PROMPT,
      prompt: `Context:\n${context}\n\nQuestion: ${question}`,
    });
    return { answer, sources };
  },

  /** What the Ask feature can see in this workspace. */
  async stats(ctx: WorkspaceContext) {
    const [docs, files, channels] = await Promise.all([
      Document.countDocuments({ teamId: ctx.key }),
      RagDocument.countDocuments({ teamId: ctx.key, ragStatus: "ready" }),
      Conversation.countDocuments({ workspaceId: ctx.workspace._id, type: "channel", isPrivate: false }),
    ]);
    return { docs, files, channels };
  },
};
