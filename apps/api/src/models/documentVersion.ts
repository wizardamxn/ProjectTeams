import mongoose, { Schema, type Types } from "mongoose";

/** A snapshot of a document as it was before an edit. */
export interface IDocumentVersion {
  _id: Types.ObjectId;
  documentId: Types.ObjectId;
  teamId: string;
  title: string;
  contentJson?: Record<string, unknown>;
  content: string;
  /** Who made the edits that this snapshot captures (the editor of the state below). */
  editedBy?: Types.ObjectId;
  /** When this state of the document was current (its updatedAt). */
  savedAt: Date;
  createdAt: Date;
}

const documentVersionSchema = new Schema<IDocumentVersion>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: "Document", required: true },
    teamId: { type: String, required: true },
    title: { type: String, required: true },
    contentJson: { type: Schema.Types.Mixed },
    content: { type: String, default: "" },
    editedBy: { type: Schema.Types.ObjectId, ref: "User" },
    savedAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

documentVersionSchema.index({ documentId: 1, savedAt: -1 });

export const DocumentVersion = mongoose.model<IDocumentVersion>("DocumentVersion", documentVersionSchema);
