import { Types } from "mongoose";
import { embed } from "../../lib/ai.js";
import { logger } from "../../lib/logger.js";
import { Conversation } from "../../models/conversation.js";
import { Document } from "../../models/document.js";
import { Message } from "../../models/message.js";
import { RagChunk, type IRagChunk } from "../../models/ragChunk.js";
import { User } from "../../models/user.js";
import { chunkText } from "./ingest.js";

// Turns workspace content into embedded chunks the Ask feature searches.
// What gets indexed: uploaded files, written docs, and PUBLIC channels.
// Private channels and DMs are never indexed, so answers can't leak them.

const CHAT_WINDOW_CHARS = 1200;
const CHAT_HISTORY_LIMIT = 3000;

const saveChunks = async (rows: Omit<IRagChunk, "_id" | "embedding">[]) => {
  if (rows.length === 0) return 0;
  const vectors = await embed(rows.map((r) => r.text));
  await RagChunk.insertMany(rows.map((r, i) => ({ ...r, embedding: vectors[i] })));
  return rows.length;
};

/** (Re)indexes one doc. A deleted or emptied doc just loses its chunks. */
export const indexDoc = async (docId: string) => {
  const doc = await Document.findById(docId);
  await RagChunk.deleteMany({ sourceType: "doc", sourceId: new Types.ObjectId(docId) });
  if (!doc) return 0;
  const text = `${doc.title}\n\n${doc.content}`.trim();
  const rows = chunkText(text).map((chunk, i) => ({
    sourceType: "doc" as const,
    sourceId: doc._id,
    title: doc.title,
    teamId: doc.teamId,
    chunkIndex: i,
    text: chunk,
  }));
  const n = await saveChunks(rows);
  logger.info({ docId, chunks: n }, "Indexed doc");
  return n;
};

/**
 * Indexes a public channel's messages as windows of consecutive lines
 * ("Name (date): text"). Incremental by default; `full` rebuilds after edits/deletes.
 */
export const indexChat = async (conversationId: string, full: boolean) => {
  const conversation = await Conversation.findById(conversationId);
  const sourceId = new Types.ObjectId(conversationId);
  if (!conversation || conversation.type !== "channel" || conversation.isPrivate) {
    await RagChunk.deleteMany({ sourceType: "chat", sourceId });
    return 0;
  }

  if (full) {
    await RagChunk.deleteMany({ sourceType: "chat", sourceId });
    conversation.indexedUntil = undefined;
  }

  const filter: Record<string, unknown> = { conversationId: sourceId, deletedAt: { $exists: false }, text: { $ne: "" } };
  if (conversation.indexedUntil) filter._id = { $gt: conversation.indexedUntil };
  const messages = await Message.find(filter).sort({ _id: 1 }).limit(CHAT_HISTORY_LIMIT).lean();
  if (messages.length === 0) {
    if (full) await conversation.save(); // records the reset
    return 0;
  }

  const users = await User.find({ _id: { $in: [...new Set(messages.map((m) => m.senderId.toString()))] } })
    .select("fullName")
    .lean();
  const nameOf = new Map(users.map((u) => [u._id.toString(), u.fullName]));

  const windows: { text: string; messageId: Types.ObjectId }[] = [];
  let current: { lines: string[]; size: number; messageId: Types.ObjectId } | null = null;
  for (const m of messages) {
    const line = `${nameOf.get(m.senderId.toString()) ?? "Someone"} (${m.createdAt.toISOString().slice(0, 10)}): ${m.text}`;
    if (!current || current.size + line.length > CHAT_WINDOW_CHARS) {
      if (current) windows.push({ text: current.lines.join("\n"), messageId: current.messageId });
      current = { lines: [], size: 0, messageId: m._id };
    }
    current.lines.push(line);
    current.size += line.length + 1;
  }
  if (current) windows.push({ text: current.lines.join("\n"), messageId: current.messageId });

  const existing = await RagChunk.countDocuments({ sourceType: "chat", sourceId });
  const n = await saveChunks(
    windows.map((w, i) => ({
      sourceType: "chat" as const,
      sourceId,
      title: `#${conversation.name}`,
      messageId: w.messageId,
      teamId: conversation.workspaceId.toString(),
      chunkIndex: existing + i,
      text: w.text,
    })),
  );
  conversation.indexedUntil = messages.at(-1)!._id;
  await conversation.save();
  logger.info({ conversationId, chunks: n, full }, "Indexed channel");
  return n;
};
