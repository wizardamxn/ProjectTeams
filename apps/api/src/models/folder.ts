import mongoose, { Schema, type HydratedDocument, type Types } from "mongoose";

/** One level of folders for organising docs in a workspace. */
export interface IFolder {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  name: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type FolderDoc = HydratedDocument<IFolder>;

const folderSchema = new Schema<IFolder>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    name: { type: String, required: true, trim: true, minLength: 1, maxLength: 60 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

folderSchema.index({ workspaceId: 1, name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

export const Folder = mongoose.model<IFolder>("Folder", folderSchema);
