import { Types } from "mongoose";
import { badRequest, forbidden, notFound } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { storage } from "../../lib/storage.js";
import { Conversation, ConversationMember, type ConversationDoc } from "../../models/conversation.js";
import { atLeast } from "../../models/membership.js";
import { Message, type IAttachment, type IMessage, type MessageDoc } from "../../models/message.js";
import { Notification, type NotificationType } from "../../models/notification.js";
import { User } from "../../models/user.js";
import { emitToUsers } from "../../realtime/emitter.js";
import { enqueueChatIndex } from "../../queues/ragQueue.js";
import type { WorkspaceContext } from "../workspaces/workspaces.service.js";
import { conversationsService } from "./conversations.service.js";

export const MAX_TEXT = 4000;
export const MAX_ATTACHMENTS = 5;
export const PAGE_SIZE = 50;

export interface SendInput {
  text?: string;
  threadRootId?: string;
  mentions?: string[];
  attachments?: IAttachment[];
}

/** Attachments live under <workspace>/chat/<conversation>/ in storage. */
export const attachmentPrefix = (ctx: WorkspaceContext, conversationId: string) => `${ctx.key}/chat/${conversationId}/`;

type Sender = { _id: string; fullName: string; avatarUrl?: string };

/** Turns stored messages into what the client sees: sender details, signed file URLs, deletions blanked. */
export const presentMessages = async (messages: (IMessage | MessageDoc)[]) => {
  const plain = messages.map((m) => ("toObject" in m ? (m.toObject() as IMessage) : m));
  const senderIds = [...new Set(plain.map((m) => m.senderId.toString()))];
  const users = await User.find({ _id: { $in: senderIds } }).select("fullName avatarUrl").lean();
  const senders = new Map<string, Sender>(
    users.map((u) => [u._id.toString(), { _id: u._id.toString(), fullName: u.fullName, avatarUrl: u.avatarUrl }]),
  );

  const paths = plain.flatMap((m) => (m.deletedAt ? [] : m.attachments.map((a) => a.storagePath)));
  let urls = new Map<string, string | null>();
  if (paths.length) {
    try {
      const signed = await storage.signedUrls(paths);
      urls = new Map(paths.map((p, i) => [p, signed[i] ?? null]));
    } catch (err) {
      logger.error({ err }, "Could not sign attachment URLs");
    }
  }

  return plain.map((m) => {
    const deleted = Boolean(m.deletedAt);
    return {
      _id: m._id.toString(),
      conversationId: m.conversationId.toString(),
      sender: senders.get(m.senderId.toString()) ?? { _id: m.senderId.toString(), fullName: "Former member" },
      text: deleted ? "" : m.text,
      threadRootId: m.threadRootId?.toString() ?? null,
      replyCount: m.replyCount ?? 0,
      lastReplyAt: m.lastReplyAt ?? null,
      mentions: deleted ? [] : (m.mentions ?? []).map(String),
      attachments: deleted
        ? []
        : m.attachments.map((a) => ({
            fileName: a.fileName,
            mimeType: a.mimeType,
            size: a.size,
            url: urls.get(a.storagePath) ?? null,
          })),
      editedAt: m.editedAt ?? null,
      deleted,
      createdAt: m.createdAt,
    };
  });
};

export type PresentedMessage = Awaited<ReturnType<typeof presentMessages>>[number];

/** Public channels feed the knowledge base. Private channels and DMs never do. */
const isIndexed = (c: ConversationDoc) => c.type === "channel" && !c.isPrivate;
const queueIndex = (c: ConversationDoc, full = false) => {
  if (!isIndexed(c)) return;
  Promise.resolve()
    .then(() => enqueueChatIndex(c._id.toString(), full))
    .catch((err) => logger.warn({ err, conversationId: c._id.toString() }, "Could not queue channel indexing"));
};

const getOwnMessage = async (ctx: WorkspaceContext, messageId: string) => {
  if (!Types.ObjectId.isValid(messageId)) throw notFound("Message not found");
  const message = await Message.findOne({ _id: messageId, workspaceId: ctx.workspace._id });
  if (!message) throw notFound("Message not found");
  // Must be able to see the conversation.
  const conversation = await conversationsService.getForMember(ctx, message.conversationId.toString());
  return { message, conversation };
};

const broadcastUpdate = async (conversation: ConversationDoc, message: MessageDoc) => {
  const [presented] = await presentMessages([message]);
  emitToUsers(await conversationsService.memberIds(conversation._id), "message:updated", {
    conversationId: conversation._id.toString(),
    message: presented,
  });
  return presented!;
};

const notify = async (
  ctx: WorkspaceContext,
  type: NotificationType,
  userIds: string[],
  message: MessageDoc,
) => {
  if (userIds.length === 0) return;
  const docs = await Notification.insertMany(
    userIds.map((userId) => ({
      userId,
      workspaceId: ctx.workspace._id,
      type,
      actorId: ctx.user._id,
      conversationId: message.conversationId,
      messageId: message._id,
      threadRootId: message.threadRootId,
      preview: message.text.slice(0, 200),
    })),
  );
  for (const doc of docs) {
    emitToUsers([doc.userId.toString()], "notification:new", {
      _id: doc._id.toString(),
      type,
      conversationId: message.conversationId.toString(),
      messageId: message._id.toString(),
      threadRootId: message.threadRootId?.toString() ?? null,
      actor: { _id: ctx.user._id.toString(), fullName: ctx.user.fullName },
      preview: doc.preview,
      createdAt: doc.createdAt,
    });
  }
};

export const messagesService = {
  /** Top-level messages, newest page first; each page is returned oldest → newest. */
  async list(ctx: WorkspaceContext, conversationId: string, { before, limit = PAGE_SIZE }: { before?: string; limit?: number }) {
    const conversation = await conversationsService.getForMember(ctx, conversationId);
    const filter: Record<string, unknown> = { conversationId: conversation._id, threadRootId: { $exists: false } };
    if (before) {
      if (!Types.ObjectId.isValid(before)) throw badRequest("Invalid cursor");
      filter._id = { $lt: new Types.ObjectId(before) };
    }
    const page = await Message.find(filter).sort({ _id: -1 }).limit(limit + 1);
    const hasMore = page.length > limit;
    const messages = await presentMessages(page.slice(0, limit).reverse());
    return { messages, hasMore };
  },

  async thread(ctx: WorkspaceContext, conversationId: string, rootId: string) {
    const conversation = await conversationsService.getForMember(ctx, conversationId);
    if (!Types.ObjectId.isValid(rootId)) throw notFound("Thread not found");
    const root = await Message.findOne({ _id: rootId, conversationId: conversation._id, threadRootId: { $exists: false } });
    if (!root) throw notFound("Thread not found");
    const replies = await Message.find({ threadRootId: root._id }).sort({ _id: 1 }).limit(500);
    const [presentedRoot, ...presentedReplies] = await presentMessages([root, ...replies]);
    return { root: presentedRoot!, replies: presentedReplies };
  },

  async send(ctx: WorkspaceContext, conversationId: string, input: SendInput) {
    const conversation = await conversationsService.getForMember(ctx, conversationId);
    const text = (input.text ?? "").trim();
    const attachments = input.attachments ?? [];
    if (!text && attachments.length === 0) throw badRequest("Message is empty");
    if (text.length > MAX_TEXT) throw badRequest("Message is too long");
    if (attachments.length > MAX_ATTACHMENTS) throw badRequest(`Up to ${MAX_ATTACHMENTS} files per message`);

    // Only files uploaded to this conversation through this API.
    const prefix = attachmentPrefix(ctx, conversation._id.toString());
    if (attachments.some((a) => !a.storagePath.startsWith(prefix) || a.storagePath.includes(".."))) {
      throw badRequest("Invalid attachment");
    }

    let root: MessageDoc | null = null;
    if (input.threadRootId) {
      if (!Types.ObjectId.isValid(input.threadRootId)) throw notFound("Thread not found");
      root = await Message.findOne({
        _id: input.threadRootId,
        conversationId: conversation._id,
        threadRootId: { $exists: false },
        deletedAt: { $exists: false },
      });
      if (!root) throw notFound("Thread not found");
    }

    const memberIds = await conversationsService.memberIds(conversation._id);
    const memberSet = new Set(memberIds);
    const me = ctx.user._id.toString();
    // You can only @mention people who are in the conversation.
    const mentions = [...new Set(input.mentions ?? [])].filter((id) => memberSet.has(id) && id !== me);

    const message = await Message.create({
      conversationId: conversation._id,
      workspaceId: ctx.workspace._id,
      senderId: ctx.user._id,
      text,
      threadRootId: root?._id,
      mentions,
      attachments,
    });

    const now = message.createdAt;
    await Promise.all([
      ConversationMember.updateOne({ conversationId: conversation._id, userId: ctx.user._id }, { $set: { lastReadAt: now } }),
      root
        ? Message.updateOne(
            { _id: root._id },
            { $inc: { replyCount: 1 }, $set: { lastReplyAt: now }, $addToSet: { threadParticipants: ctx.user._id } },
          )
        : Conversation.updateOne({ _id: conversation._id }, { $set: { lastMessageAt: now } }),
    ]);

    const [presented] = await presentMessages([message]);
    emitToUsers(memberIds, "message:new", { conversationId: conversation._id.toString(), message: presented });
    queueIndex(conversation);

    if (root) {
      const updatedRoot = await Message.findById(root._id);
      if (updatedRoot) await broadcastUpdate(conversation, updatedRoot);
    }

    // Notifications: @mentions first; then everyone else following the thread.
    await notify(ctx, "mention", mentions, message);
    if (root) {
      const followers = [root.senderId.toString(), ...root.threadParticipants.map(String)];
      const toNotify = [...new Set(followers)].filter((id) => id !== me && !mentions.includes(id) && memberSet.has(id));
      await notify(ctx, "thread_reply", toNotify, message);
    }

    return presented!;
  },

  /** Only the sender edits. */
  async edit(ctx: WorkspaceContext, messageId: string, text: string) {
    const { message, conversation } = await getOwnMessage(ctx, messageId);
    if (!message.senderId.equals(ctx.user._id)) throw forbidden("You can only edit your own messages");
    if (message.deletedAt) throw badRequest("This message was deleted");
    const trimmed = text.trim();
    if (!trimmed && message.attachments.length === 0) throw badRequest("Message is empty");
    if (trimmed.length > MAX_TEXT) throw badRequest("Message is too long");
    message.text = trimmed;
    message.editedAt = new Date();
    await message.save();
    queueIndex(conversation, true);
    return broadcastUpdate(conversation, message);
  },

  /** The sender or a workspace admin deletes. The message stays as "deleted" so threads keep their shape. */
  async remove(ctx: WorkspaceContext, messageId: string) {
    const { message, conversation } = await getOwnMessage(ctx, messageId);
    const allowed = message.senderId.equals(ctx.user._id) || atLeast(ctx.membership.role, "admin");
    if (!allowed) throw forbidden("You can only delete your own messages");
    if (message.deletedAt) return;

    const paths = message.attachments.map((a) => a.storagePath);
    message.deletedAt = new Date();
    message.text = "";
    message.mentions = [];
    message.attachments = [];
    await message.save();
    await Notification.deleteMany({ messageId: message._id });
    queueIndex(conversation, true); // deleted text must leave the knowledge base too
    await Promise.all(paths.map((p) => storage.remove(p).catch((err) => logger.error({ err, p }, "Could not remove attachment"))));
    await broadcastUpdate(conversation, message);
  },
};
