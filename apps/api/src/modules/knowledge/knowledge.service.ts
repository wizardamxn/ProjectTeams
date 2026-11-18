import type { Types } from "mongoose";
import { embed } from "../../lib/ai.js";
import { conflict, notFound } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { storage } from "../../lib/storage.js";
import { RagChunk } from "../../models/ragChunk.js";
import { RagDocument, type RagDocumentDoc } from "../../models/ragDocument.js";
import type { UserDoc } from "../../models/user.js";
import { enqueueIngest } from "../../queues/ragQueue.js";
import { safeFileName } from "./ingest.js";

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

const getTeamFile = async (user: UserDoc, id: string) => {
  const doc = await RagDocument.findOne({ _id: id, teamId: user.teamCode });
  if (!doc) throw notFound("Document not found");
  return doc;
};

export const knowledgeService = {
  async upload(user: UserDoc, file: UploadedFile) {
    const storagePath = `${user.teamCode}/${Date.now()}-${safeFileName(file.originalname)}`;
    await storage.upload(storagePath, file.buffer, file.mimetype);

    const doc = await RagDocument.create({
      fileName: file.originalname.slice(0, 200),
      fileUrl: storagePath,
      storagePath,
      mimeType: file.mimetype,
      fileSize: file.size,
      teamId: user.teamCode,
      uploadedBy: user._id,
    });
    const [signed] = await withSignedUrls([doc]);
    return signed;
  },

  async list(user: UserDoc) {
    const docs = await RagDocument.find({ teamId: user.teamCode }).sort({ createdAt: -1 });
    return withSignedUrls(docs);
  },

  async get(user: UserDoc, id: string) {
    const doc = await getTeamFile(user, id);
    const chunks = await RagChunk.find({ documentId: doc._id })
      .select("chunkIndex text")
      .sort({ chunkIndex: 1 });
    const [signed] = await withSignedUrls([doc]);
    return { document: signed, chunks };
  },

  async startIndexing(user: UserDoc, id: string) {
    const doc = await getTeamFile(user, id);
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

  async remove(user: UserDoc, id: string) {
    const doc = await getTeamFile(user, id);
    await RagChunk.deleteMany({ documentId: doc._id });
    await storage.remove(doc.storagePath).catch((err) =>
      logger.error({ err, path: doc.storagePath }, "Could not remove file from storage"),
    );
    await doc.deleteOne();
  },

  /** Nearest chunks to `question`, restricted to the team inside the vector index. */
  async search(teamId: string, question: string, limit = 5) {
    const [queryVector] = await embed([question]);
    if (!queryVector) return [];
    return RagChunk.aggregate<{ _id: Types.ObjectId; text: string; documentId: Types.ObjectId; score: number }>([
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
      { $project: { text: 1, documentId: 1, score: { $meta: "vectorSearchScore" } } },
    ]);
  },
};
