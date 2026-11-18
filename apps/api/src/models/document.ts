import mongoose, { Schema, type HydratedDocument, type Types } from "mongoose";

export interface IDocument {
  _id: Types.ObjectId;
  title: string;
  content: string;
  summary?: string;
  tags: string[];
  createdBy: Types.ObjectId;
  teamId: string;
  author: { name: string; avatar?: string };
  starred: boolean;
  versions: { content: string; updatedAt: Date }[];
  createdAt: Date;
  updatedAt: Date;
}

export type DocumentDoc = HydratedDocument<IDocument>;

const documentSchema = new Schema<IDocument>(
  {
    title: { type: String, required: true, maxLength: 100 },
    // Raised from 5,000 in Phase 2; Phase 5 moves docs to rich text.
    content: { type: String, required: true, maxLength: 100_000 },
    summary: { type: String },
    tags: [{ type: String }],
    createdBy: { type: Schema.Types.ObjectId, required: true, index: true },
    teamId: { type: String, required: true },
    author: {
      type: new Schema({ name: { type: String, required: true }, avatar: String }, { _id: false }),
      required: true,
    },
    starred: { type: Boolean, default: false },
    versions: [{ content: String, updatedAt: { type: Date, default: Date.now } }],
  },
  { timestamps: true },
);

documentSchema.index({ teamId: 1, updatedAt: -1 });

export const Document = mongoose.model<IDocument>("Document", documentSchema);
