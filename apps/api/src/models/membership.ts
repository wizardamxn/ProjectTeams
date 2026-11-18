import mongoose, { Schema, type HydratedDocument, type Types } from "mongoose";

export const ROLES = ["owner", "admin", "member"] as const;
export type Role = (typeof ROLES)[number];

/** owner > admin > member */
export const ROLE_RANK: Record<Role, number> = { owner: 3, admin: 2, member: 1 };
export const atLeast = (role: Role, min: Role) => ROLE_RANK[role] >= ROLE_RANK[min];

export interface IMembership {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

export type MembershipDoc = HydratedDocument<IMembership>;

const membershipSchema = new Schema<IMembership>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, enum: ROLES, required: true, default: "member" },
  },
  { timestamps: true },
);

membershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });

export const Membership = mongoose.model<IMembership>("Membership", membershipSchema);
