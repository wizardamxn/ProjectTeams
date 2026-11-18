import mongoose, { Schema, type Types } from "mongoose";

/**
 * One live edit to a doc (a Yjs update), appended as it arrives. A doc's
 * current state is its compacted `ystate` plus every update after
 * `ycompactedUntil`. Appending (rather than rewriting one blob) keeps
 * concurrent writers, across processes, from losing each other's edits.
 */
export interface IDocUpdate {
  _id: Types.ObjectId;
  docId: Types.ObjectId;
  userId?: Types.ObjectId;
  update: Buffer;
}

const docUpdateSchema = new Schema<IDocUpdate>(
  {
    docId: { type: Schema.Types.ObjectId, ref: "Document", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    update: { type: Buffer, required: true },
  },
  { versionKey: false },
);

docUpdateSchema.index({ docId: 1, _id: 1 });

export const DocUpdate = mongoose.model<IDocUpdate>("DocUpdate", docUpdateSchema);
