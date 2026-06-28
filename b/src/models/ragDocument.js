import mongoose from "mongoose";

const ragDocumentSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    storagePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    teamId: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, required: true },
    ragStatus: {
      type: String,
      enum: ["uploaded", "processing", "ready", "failed"],
      default: "uploaded",
    },
  },
  { timestamps: true }
);

const RagDocument = mongoose.model("RagDocument", ragDocumentSchema);
export default RagDocument;
