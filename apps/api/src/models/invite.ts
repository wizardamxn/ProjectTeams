import mongoose, { Schema, type HydratedDocument, type Types } from "mongoose";

export const INVITE_ROLES = ["admin", "member"] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

export interface IInvite {
  _id: Types.ObjectId;
  /** Random secret in the invite URL. Admins can copy a live link again, so it's stored as-is. */
  token: string;
  workspaceId: Types.ObjectId;
  role: InviteRole;
  /** When set, only this email can accept (email invites). Empty = shareable link. */
  email?: string;
  createdBy: Types.ObjectId;
  expiresAt: Date;
  maxUses?: number;
  uses: number;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type InviteDoc = HydratedDocument<IInvite>;

const inviteSchema = new Schema<IInvite>(
  {
    token: { type: String, required: true, unique: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    role: { type: String, enum: INVITE_ROLES, default: "member" },
    email: { type: String, lowercase: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
    maxUses: { type: Number, min: 1 },
    uses: { type: Number, default: 0 },
    revokedAt: { type: Date },
  },
  { timestamps: true },
);

export const isInviteUsable = (invite: IInvite, now = new Date()) =>
  !invite.revokedAt &&
  invite.expiresAt > now &&
  (invite.maxUses === undefined || invite.uses < invite.maxUses);

export const Invite = mongoose.model<IInvite>("Invite", inviteSchema);
