import mongoose, { Schema, type Types } from "mongoose";
import { config } from "../config.js";

export const AUDIT_ACTIONS = [
  "workspace.renamed",
  "workspace.exported",
  "member.joined",
  "member.left",
  "member.removed",
  "member.role_changed",
  "ownership.transferred",
  "invite.created",
  "invite.revoked",
  "channel.created",
  "channel.renamed",
  "doc.deleted",
  "doc.version_restored",
  "folder.deleted",
  "file.uploaded",
  "file.deleted",
  "webhook.created",
  "webhook.updated",
  "webhook.deleted",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface IAuditEvent {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  /** Who did it. Null for system actions. */
  actorId: Types.ObjectId | null;
  /** Name at the time, so the log still reads right after people leave or rename. */
  actorName: string;
  action: AuditAction;
  target?: { type: string; id?: string; label?: string };
  meta?: Record<string, unknown>;
  ip?: string;
  createdAt: Date;
}

const auditEventSchema = new Schema<IAuditEvent>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    actorName: { type: String, required: true },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    target: {
      _id: false,
      type: { type: String },
      id: { type: String },
      label: { type: String, maxLength: 200 },
    },
    meta: { type: Schema.Types.Mixed },
    ip: { type: String },
  },
  // Append-only: no updatedAt.
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditEventSchema.index({ workspaceId: 1, _id: -1 });
auditEventSchema.index({ workspaceId: 1, action: 1, _id: -1 });
auditEventSchema.index({ workspaceId: 1, actorId: 1, _id: -1 });
// Old events expire on their own.
auditEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: config.AUDIT_RETENTION_DAYS * 24 * 60 * 60 });

export const AuditEvent = mongoose.model<IAuditEvent>("AuditEvent", auditEventSchema);
