import mongoose, { Schema, type Types } from "mongoose";

export const SOURCE_TYPES = ["file", "doc", "chat"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export interface IRagChunk {
  _id: Types.ObjectId;
  /** What the text came from: an uploaded file, a written doc, or a public channel. */
  sourceType: SourceType;
  /** RagDocument id (file), Document id (doc) or Conversation id (chat). */
  sourceId?: Types.ObjectId;
  /** LEGACY name for sourceId on file chunks; kept so existing chunks keep working. */
  documentId?: Types.ObjectId;
  /** Shown in citations: file name, doc title or "#channel". */
  title?: string;
  /** Chat chunks: the first message in the window, for linking. */
  messageId?: Types.ObjectId;
  teamId: string;
  chunkIndex: number;
  text: string;
  embedding: number[];
}

// Vector search runs on the Atlas index "rag_chunk_vector_index"
// (path: embedding, filter field: teamId). It is created in Atlas, not here.
const ragChunkSchema = new Schema<IRagChunk>(
  {
    sourceType: { type: String, enum: SOURCE_TYPES, default: "file" },
    sourceId: { type: Schema.Types.ObjectId, index: true },
    documentId: { type: Schema.Types.ObjectId, index: true },
    title: { type: String },
    messageId: { type: Schema.Types.ObjectId },
    teamId: { type: String, required: true },
    chunkIndex: { type: Number, required: true },
    text: { type: String, required: true },
    embedding: { type: [Number], required: true },
  },
  { timestamps: true },
);

export const RagChunk = mongoose.model<IRagChunk>("RagChunk", ragChunkSchema);
