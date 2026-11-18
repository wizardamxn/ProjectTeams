import mongoose, { Schema, type Types } from "mongoose";

export interface IRagChunk {
  _id: Types.ObjectId;
  documentId: Types.ObjectId;
  teamId: string;
  chunkIndex: number;
  text: string;
  embedding: number[];
}

// Vector search runs on the Atlas index "rag_chunk_vector_index"
// (path: embedding, filter field: teamId). It is created in Atlas, not here.
const ragChunkSchema = new Schema<IRagChunk>(
  {
    documentId: { type: Schema.Types.ObjectId, required: true, index: true },
    // Workspace id as a string. Named teamId because the Atlas vector index filters on it.
    teamId: { type: String, required: true },
    chunkIndex: { type: Number, required: true },
    text: { type: String, required: true },
    embedding: { type: [Number], required: true },
  },
  { timestamps: true },
);

export const RagChunk = mongoose.model<IRagChunk>("RagChunk", ragChunkSchema);
