import { Types } from "mongoose";
import { Conversation } from "../../models/conversation.js";
import { Document } from "../../models/document.js";
import { Notification } from "../../models/notification.js";
import { User } from "../../models/user.js";
import type { WorkspaceContext } from "../workspaces/workspaces.service.js";

export const notificationsService = {
  /** Latest 50 in the active workspace, with who did it and where. */
  async list(ctx: WorkspaceContext) {
    const items = await Notification.find({ userId: ctx.user._id, workspaceId: ctx.workspace._id })
      .sort({ _id: -1 })
      .limit(50)
      .lean();
    const [actors, conversations, docs, unread] = await Promise.all([
      User.find({ _id: { $in: items.map((n) => n.actorId) } }).select("fullName avatarUrl").lean(),
      Conversation.find({ _id: { $in: items.flatMap((n) => n.conversationId ?? []) } }).select("type name").lean(),
      Document.find({ _id: { $in: items.flatMap((n) => n.docId ?? []) } }).select("title").lean(),
      Notification.countDocuments({ userId: ctx.user._id, workspaceId: ctx.workspace._id, readAt: { $exists: false } }),
    ]);
    const actorBy = new Map(actors.map((a) => [a._id.toString(), a]));
    const convBy = new Map(conversations.map((c) => [c._id.toString(), c]));
    const docBy = new Map(docs.map((d) => [d._id.toString(), d]));

    return {
      unread,
      items: items.map((n) => {
        const actor = actorBy.get(n.actorId.toString());
        const conv = n.conversationId ? convBy.get(n.conversationId.toString()) : undefined;
        const doc = n.docId ? docBy.get(n.docId.toString()) : undefined;
        return {
          _id: n._id.toString(),
          type: n.type,
          conversationId: n.conversationId?.toString() ?? null,
          conversationName: n.docId ? (doc?.title ?? "a deleted doc") : conv?.type === "channel" ? `#${conv.name}` : "a direct message",
          messageId: n.messageId?.toString() ?? null,
          threadRootId: n.threadRootId?.toString() ?? null,
          docId: n.docId?.toString() ?? null,
          commentId: n.commentId?.toString() ?? null,
          actor: { _id: n.actorId.toString(), fullName: actor?.fullName ?? "Someone", avatarUrl: actor?.avatarUrl },
          preview: n.preview ?? "",
          read: Boolean(n.readAt),
          createdAt: n.createdAt,
        };
      }),
    };
  },

  /** Marks the given notifications (or all of them) read. */
  async markRead(ctx: WorkspaceContext, ids?: string[]) {
    const filter: Record<string, unknown> = { userId: ctx.user._id, workspaceId: ctx.workspace._id, readAt: { $exists: false } };
    if (ids) filter._id = { $in: ids.filter((id) => Types.ObjectId.isValid(id)) };
    await Notification.updateMany(filter, { $set: { readAt: new Date() } });
  },
};
