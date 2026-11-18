import { badRequest, forbidden } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { storage } from "../../lib/storage.js";
import { AuditEvent } from "../../models/auditEvent.js";
import { Chat } from "../../models/chat.js";
import { Conversation, ConversationMember } from "../../models/conversation.js";
import { Document } from "../../models/document.js";
import { DocumentVersion } from "../../models/documentVersion.js";
import { Folder } from "../../models/folder.js";
import { Invite } from "../../models/invite.js";
import { Membership } from "../../models/membership.js";
import { Message } from "../../models/message.js";
import { Notification } from "../../models/notification.js";
import { RagChunk } from "../../models/ragChunk.js";
import { RagDocument } from "../../models/ragDocument.js";
import { User } from "../../models/user.js";
import { Workspace } from "../../models/workspace.js";
import { DocComment } from "../../models/docComment.js";
import { DocUpdate } from "../../models/docUpdate.js";
import { Webhook, WebhookDelivery } from "../../models/webhook.js";
import { emitToUsers } from "../../realtime/emitter.js";
import type { WorkspaceContext } from "./workspaces.service.js";

/** Removes stored files in the background; a failure leaves an orphan, never a broken delete. */
const removeFiles = async (paths: string[]) => {
  let failed = 0;
  for (const path of paths) {
    await storage.remove(path).catch(() => failed++);
  }
  if (failed) logger.error({ failed, total: paths.length }, "workspace delete: some stored files were not removed");
};

/**
 * Permanently deletes the workspace and everything in it. Owner only, and the
 * caller must type the workspace's name to confirm.
 */
export const deleteWorkspace = async (ctx: WorkspaceContext, confirmName: string) => {
  if (ctx.membership.role !== "owner") throw forbidden("Only the owner can delete the workspace");
  if (confirmName.trim() !== ctx.workspace.name) throw badRequest("Type the workspace name exactly to confirm");

  const wsId = ctx.workspace._id;
  const key = ctx.key;
  const memberIds = (await Membership.find({ workspaceId: wsId }).select("userId").lean()).map((m) => m.userId);

  // Collect stored files before the records pointing at them go.
  const [files, attachments] = await Promise.all([
    RagDocument.find({ teamId: key }).select("storagePath").lean(),
    Message.find({ workspaceId: wsId, "attachments.0": { $exists: true } }).select("attachments.storagePath").lean(),
  ]);
  const paths = [...files.map((f) => f.storagePath), ...attachments.flatMap((m) => m.attachments.map((a) => a.storagePath))];

  // Memberships first: from here on nobody can reach the workspace.
  await Membership.deleteMany({ workspaceId: wsId });
  await Workspace.deleteOne({ _id: wsId });

  const conversationIds = (await Conversation.find({ workspaceId: wsId }).select("_id").lean()).map((c) => c._id);
  const docIds = (await Document.find({ teamId: key }).select("_id").lean()).map((d) => d._id);
  await Promise.all([
    Document.deleteMany({ teamId: key }),
    DocumentVersion.deleteMany({ teamId: key }),
    Folder.deleteMany({ workspaceId: wsId }),
    RagDocument.deleteMany({ teamId: key }),
    RagChunk.deleteMany({ teamId: key }),
    ConversationMember.deleteMany({ conversationId: { $in: conversationIds } }),
    Message.deleteMany({ workspaceId: wsId }),
    Conversation.deleteMany({ workspaceId: wsId }),
    Notification.deleteMany({ workspaceId: wsId }),
    Invite.deleteMany({ workspaceId: wsId }),
    AuditEvent.deleteMany({ workspaceId: wsId }),
    Chat.deleteMany({ workspaceId: wsId }),
    DocComment.deleteMany({ teamId: key }),
    DocUpdate.deleteMany({ docId: { $in: docIds } }),
    Webhook.deleteMany({ workspaceId: wsId }),
    WebhookDelivery.deleteMany({ workspaceId: wsId }),
    User.updateMany({ activeWorkspaceId: wsId }, { $unset: { activeWorkspaceId: 1 } }),
    // A migrated team code would otherwise recreate an empty "Team 1234" on next sign-in.
    ...(ctx.workspace.legacyTeamCode ? [User.updateMany({ teamCode: ctx.workspace.legacyTeamCode }, { $unset: { teamCode: 1 } })] : []),
  ]);

  logger.info({ workspaceId: key, by: ctx.user._id.toString(), files: paths.length }, "workspace deleted");
  emitToUsers(memberIds.map(String), "workspace:deleted", { workspaceId: key, name: ctx.workspace.name, by: ctx.user._id.toString() });
  void removeFiles(paths);
};
