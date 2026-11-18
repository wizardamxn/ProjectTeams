import mongoose, { Schema, type HydratedDocument, type Types } from "mongoose";

export interface IDocument {
  _id: Types.ObjectId;
  title: string;
  /** Rich text: the editor's (Tiptap / ProseMirror) JSON. Absent on docs written before Phase 5. */
  contentJson?: Record<string, unknown>;
  /** Plain text, always derived on the server from contentJson. Used for search, AI and indexing. */
  content: string;
  summary?: string;
  tags: string[];
  folderId?: Types.ObjectId;
  createdBy: Types.ObjectId;
  lastEditedBy?: Types.ObjectId;
  // Workspace id as a string. Named teamId because the Atlas vector index filters on it.
  teamId: string;
  author: { name: string; avatar?: string };
  /** Who has starred it (stars are personal). */
  starredBy: Types.ObjectId[];
  /** LEGACY: pre-Phase-5 team-wide star. Migrated into starredBy on first read. */
  starred?: boolean;
  /** LEGACY: pre-Phase-5 embedded history. Moved into DocumentVersion on first read. */
  versions?: { content: string; updatedAt: Date }[];
  createdAt: Date;
  updatedAt: Date;
}

export type DocumentDoc = HydratedDocument<IDocument>;

const documentSchema = new Schema<IDocument>(
  {
    title: { type: String, required: true, maxLength: 200 },
    contentJson: { type: Schema.Types.Mixed },
    content: { type: String, default: "", maxLength: 200_000 },
    summary: { type: String },
    tags: [{ type: String }],
    folderId: { type: Schema.Types.ObjectId, ref: "Folder" },
    createdBy: { type: Schema.Types.ObjectId, required: true, index: true },
    lastEditedBy: { type: Schema.Types.ObjectId },
    teamId: { type: String, required: true },
    author: {
      type: new Schema({ name: { type: String, required: true }, avatar: String }, { _id: false }),
      required: true,
    },
    starredBy: [{ type: Schema.Types.ObjectId }],
    starred: { type: Boolean },
    versions: [{ content: String, updatedAt: { type: Date, default: Date.now } }],
  },
  { timestamps: true, minimize: false },
);

documentSchema.index({ teamId: 1, updatedAt: -1 });
documentSchema.index({ teamId: 1, folderId: 1 });
documentSchema.index({ title: "text", content: "text" }, { weights: { title: 5, content: 1 }, name: "document_text" });

export const Document = mongoose.model<IDocument>("Document", documentSchema);
