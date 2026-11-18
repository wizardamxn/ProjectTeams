import mongoose, { Schema, type HydratedDocument, type Types } from "mongoose";

export const RAG_STATUSES = ["uploaded", "processing", "ready", "failed"] as const;
export type RagStatus = (typeof RAG_STATUSES)[number];

export interface IRagDocument {
  _id: Types.ObjectId;
  fileName: string;
  /** Legacy field; real links are signed per request from `storagePath`. */
  fileUrl: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  teamId: string;
  uploadedBy: Types.ObjectId;
  ragStatus: RagStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type RagDocumentDoc = HydratedDocument<IRagDocument>;

const ragDocumentSchema = new Schema<IRagDocument>(
  {
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    storagePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    teamId: { type: String, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, required: true },
    ragStatus: { type: String, enum: RAG_STATUSES, default: "uploaded" },
  },
  { timestamps: true },
);

ragDocumentSchema.index({ teamId: 1, createdAt: -1 });

export const RagDocument = mongoose.model<IRagDocument>("RagDocument", ragDocumentSchema);
