import mongoose, { Schema, type HydratedDocument, type Types } from "mongoose";

/**
 * A comment on a doc. Thread roots highlight the text they're about (a
 * `comment` mark with this id lives in the doc body); replies have a parentId.
 */
export interface IDocComment {
  _id: Types.ObjectId;
  docId: Types.ObjectId;
  teamId: string;
  parentId?: Types.ObjectId;
  authorId: Types.ObjectId;
  text: string;
  /** The highlighted text when the thread started (roots only). */
  quote?: string;
  resolvedAt?: Date;
  resolvedBy?: Types.ObjectId;
  editedAt?: Date;
  createdAt: Date;
}

export type DocCommentDoc = HydratedDocument<IDocComment>;

const docCommentSchema = new Schema<IDocComment>(
  {
    docId: { type: Schema.Types.ObjectId, ref: "Document", required: true },
    teamId: { type: String, required: true },
    parentId: { type: Schema.Types.ObjectId, ref: "DocComment" },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, maxLength: 5000 },
    quote: { type: String, maxLength: 500 },
    resolvedAt: { type: Date },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    editedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

docCommentSchema.index({ docId: 1, _id: 1 });
docCommentSchema.index({ teamId: 1 });

export const DocComment = mongoose.model<IDocComment>("DocComment", docCommentSchema);
