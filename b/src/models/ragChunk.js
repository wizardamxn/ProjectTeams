import mongoose from "mongoose";

const ragChunkSchema = new mongoose.Schema(
  {
    documentId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    teamId: { type: String, required: true },
    chunkIndex: { type: Number, required: true },
    text: { type: String, required: true },
    embedding: { type: [Number], required: true },
  },
  { timestamps: true }
);

const RagChunk = mongoose.model("RagChunk", ragChunkSchema);
export default RagChunk;
