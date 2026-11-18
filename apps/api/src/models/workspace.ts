import mongoose, { Schema, type HydratedDocument, type Types } from "mongoose";

export interface IWorkspace {
  _id: Types.ObjectId;
  name: string;
  createdBy: Types.ObjectId;
  /** Set on workspaces migrated from the old shared 8-digit team codes. */
  legacyTeamCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type WorkspaceDoc = HydratedDocument<IWorkspace>;

const workspaceSchema = new Schema<IWorkspace>(
  {
    name: { type: String, required: true, trim: true, minLength: 1, maxLength: 60 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    legacyTeamCode: { type: String, unique: true, sparse: true },
  },
  { timestamps: true },
);

export const Workspace = mongoose.model<IWorkspace>("Workspace", workspaceSchema);
