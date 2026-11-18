import { Types } from "mongoose";
import { badRequest, conflict, forbidden, notFound } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { Chat } from "../../models/chat.js";
import {
  Conversation,
  ConversationMember,
  GENERAL_CHANNEL,
  type ConversationDoc,
} from "../../models/conversation.js";
import { atLeast, Membership } from "../../models/membership.js";
import { Message } from "../../models/message.js";
import { Notification } from "../../models/notification.js";
import { User } from "../../models/user.js";
import type { WorkspaceContext } from "../workspaces/workspaces.service.js";
import { auditService } from "../audit/audit.service.js";

export const MAX_GROUP_SIZE = 8; // including you

/** "Design Team!" -> "design-team" */
export const channelName = (raw: string) =>
  raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // é -> e
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

const dmKeyOf = (ids: Types.ObjectId[]) =>
  ids
    .map(String)
    .sort()
    .join(":");

const isDuplicate = (err: unknown) => (err as { code?: number }).code === 11000;

/** Only ids of people in this workspace survive. */
const workspaceMemberIds = async (ctx: WorkspaceContext, ids: string[]) => {
  const valid = ids.filter((id) => Types.ObjectId.isValid(id));
  const found = await Membership.find({ workspaceId: ctx.workspace._id, userId: { $in: valid } }).select("userId");
  return found.map((m) => m.userId);
};

const join = (conversation: ConversationDoc, userIds: Types.ObjectId[]) =>
  userIds.length
    ? ConversationMember.bulkWrite(
        userIds.map((userId) => ({
          updateOne: {
            filter: { conversationId: conversation._id, userId },
            // New members start "caught up"; old history isn't unread.
            update: { $setOnInsert: { workspaceId: conversation.workspaceId, lastReadAt: new Date() } },
            upsert: true,
          },
        })),
      )
    : Promise.resolve();

export const conversationsService = {
  /** #general exists in every workspace and everyone is in it. */
  async ensureGeneral(ctx: WorkspaceContext) {
    let general = await Conversation.findOne({ workspaceId: ctx.workspace._id, isDefault: true });
    if (!general) {
      try {
        general = await Conversation.create({
          workspaceId: ctx.workspace._id,
          type: "channel",
          name: GENERAL_CHANNEL,
          topic: "Company-wide announcements and chatter",
          isDefault: true,
          createdBy: ctx.workspace.createdBy,
        });
      } catch (err) {
        if (!isDuplicate(err)) throw err;
        // Raced with another request, or a channel called "general" already exists: adopt it.
        general = await Conversation.findOneAndUpdate(
          { workspaceId: ctx.workspace._id, $or: [{ isDefault: true }, { type: "channel", name: GENERAL_CHANNEL }] },
          { $set: { isDefault: true, isPrivate: false } },
          { new: true },
        );
        if (!general) throw err;
      }
    }
    // Everyone in the workspace, not just the caller: otherwise people who haven't opened
    // chat yet can't be mentioned, notified or reached in #general.
    const [everyone, inGeneral] = await Promise.all([
      Membership.find({ workspaceId: ctx.workspace._id }).select("userId").lean(),
      ConversationMember.find({ conversationId: general._id }).select("userId").lean(),
    ]);
    const joined = new Set(inGeneral.map((m) => m.userId.toString()));
    const missing = everyone.map((m) => m.userId).filter((id) => !joined.has(id.toString()));
    await join(general, missing);
    return general;
  },

  /**
   * Moves this workspace's pre-Phase-4 chats (messages embedded in one
   * document) into DM conversations. Idempotent; runs on first use.
   */
  async migrateLegacyChats(ctx: WorkspaceContext) {
    const legacy = await Chat.find({ workspaceId: ctx.workspace._id, migratedAt: { $exists: false } });
    for (const chat of legacy) {
      const participants = chat.participants;
      let conversation: ConversationDoc | null = null;
      if (participants.length >= 2) {
        const dmKey = dmKeyOf(participants);
        conversation = await Conversation.findOneAndUpdate(
          { workspaceId: ctx.workspace._id, dmKey },
          {
            $setOnInsert: {
              type: "dm",
              createdBy: participants[0],
              isPrivate: true,
              lastMessageAt: chat.messages.at(-1)?.createdAt ?? chat.updatedAt,
            },
          },
          { upsert: true, new: true },
        );
        if (!conversation) continue;
        await join(conversation, participants);

        const alreadyCopied = await Message.exists({ conversationId: conversation._id });
        if (!alreadyCopied && chat.messages.length) {
          // Raw insert keeps the original timestamps.
          await Message.collection.insertMany(
            chat.messages.map((m) => ({
              _id: new Types.ObjectId(),
              conversationId: conversation!._id,
              workspaceId: ctx.workspace._id,
              senderId: m.senderId,
              text: m.text,
              replyCount: 0,
              threadParticipants: [],
              mentions: [],
              attachments: [],
              createdAt: m.createdAt,
              updatedAt: m.createdAt,
            })),
          );
        }
      }
      chat.migratedAt = new Date();
      await chat.save();
      logger.info({ chatId: chat._id.toString(), conversationId: conversation?._id.toString() }, "Migrated legacy chat");
    }
  },

  /** The conversations in your sidebar: channels you're in, DMs and groups, with unread counts. */
  async listMine(ctx: WorkspaceContext) {
    await this.migrateLegacyChats(ctx);
    await this.ensureGeneral(ctx);

    const memberships = await ConversationMember.find({ workspaceId: ctx.workspace._id, userId: ctx.user._id }).lean();
    const ids = memberships.map((m) => m.conversationId);
    const [conversations, allMembers] = await Promise.all([
      Conversation.find({ _id: { $in: ids } }).lean(),
      ConversationMember.find({ conversationId: { $in: ids } }).select("conversationId userId").lean(),
    ]);

    // Names and avatars for DMs and groups.
    const dmIds = new Set(conversations.filter((c) => c.type !== "channel").map((c) => c._id.toString()));
    const peopleIds = allMembers
      .filter((m) => dmIds.has(m.conversationId.toString()) && !m.userId.equals(ctx.user._id))
      .map((m) => m.userId);
    const people = await User.find({ _id: { $in: peopleIds } }).select("fullName avatarUrl").lean();
    const personById = new Map(people.map((p) => [p._id.toString(), { _id: p._id.toString(), fullName: p.fullName, avatarUrl: p.avatarUrl }]));

    const lastReadBy = new Map(memberships.map((m) => [m.conversationId.toString(), m.lastReadAt]));

    const [unreadCounts, mentionCounts] = await Promise.all([
      Promise.all(
        conversations.map((c) =>
          Message.countDocuments(
            {
              conversationId: c._id,
              threadRootId: { $exists: false },
              deletedAt: { $exists: false },
              senderId: { $ne: ctx.user._id },
              createdAt: { $gt: lastReadBy.get(c._id.toString()) ?? new Date(0) },
            },
            { limit: 100 },
          ),
        ),
      ),
      Notification.aggregate<{ _id: Types.ObjectId; n: number }>([
        { $match: { userId: ctx.user._id, workspaceId: ctx.workspace._id, readAt: { $exists: false } } },
        { $group: { _id: "$conversationId", n: { $sum: 1 } } },
      ]),
    ]);
    const mentionsBy = new Map(mentionCounts.map((m) => [m._id.toString(), m.n]));

    return conversations
      .map((c, i) => {
        const id = c._id.toString();
        return {
          _id: id,
          type: c.type,
          name: c.name ?? null,
          topic: c.topic ?? null,
          isPrivate: c.isPrivate,
          isDefault: c.isDefault,
          members:
            c.type === "channel"
              ? []
              : allMembers
                  .filter((m) => m.conversationId.equals(c._id) && !m.userId.equals(ctx.user._id))
                  .flatMap((m) => personById.get(m.userId.toString()) ?? []),
          memberCount: allMembers.filter((m) => m.conversationId.equals(c._id)).length,
          unreadCount: unreadCounts[i] ?? 0,
          mentionCount: mentionsBy.get(id) ?? 0,
          lastMessageAt: c.lastMessageAt ?? c.createdAt,
        };
      })
      .sort((a, b) => {
        if (a.type === "channel" && b.type === "channel") return (a.name ?? "").localeCompare(b.name ?? "");
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      });
  },

  /** Public channels you could join. */
  async browse(ctx: WorkspaceContext) {
    await this.ensureGeneral(ctx);
    const mine = await ConversationMember.find({ workspaceId: ctx.workspace._id, userId: ctx.user._id }).distinct("conversationId");
    const channels = await Conversation.find({
      workspaceId: ctx.workspace._id,
      type: "channel",
      isPrivate: false,
      _id: { $nin: mine },
    })
      .sort({ name: 1 })
      .lean();
    const counts = await ConversationMember.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { conversationId: { $in: channels.map((c) => c._id) } } },
      { $group: { _id: "$conversationId", n: { $sum: 1 } } },
    ]);
    const countBy = new Map(counts.map((c) => [c._id.toString(), c.n]));
    return channels.map((c) => ({
      _id: c._id.toString(),
      name: c.name,
      topic: c.topic ?? null,
      memberCount: countBy.get(c._id.toString()) ?? 0,
    }));
  },

  async createChannel(
    ctx: WorkspaceContext,
    input: { name: string; topic?: string; isPrivate?: boolean; memberIds?: string[] },
  ) {
    const name = channelName(input.name);
    if (!name) throw badRequest("Channel names use letters, numbers and dashes");
    if (await Conversation.exists({ workspaceId: ctx.workspace._id, type: "channel", name })) {
      throw conflict(`#${name} already exists`);
    }
    const channel = await Conversation.create({
      workspaceId: ctx.workspace._id,
      type: "channel",
      name,
      topic: input.topic,
      isPrivate: input.isPrivate ?? false,
      createdBy: ctx.user._id,
    }).catch((err) => {
      throw isDuplicate(err) ? conflict(`#${name} already exists`) : err;
    });
    const others = await workspaceMemberIds(ctx, input.memberIds ?? []);
    await join(channel, [ctx.user._id, ...others]);
    auditService.record(ctx, "channel.created", { type: "channel", id: channel._id.toString(), label: `#${name}` }, { private: channel.isPrivate });
    return channel;
  },

  /** The conversation, if you're in it. Anything else is a 404. */
  async getForMember(ctx: WorkspaceContext, id: string) {
    if (!Types.ObjectId.isValid(id)) throw notFound("Conversation not found");
    const [conversation, member] = await Promise.all([
      Conversation.findOne({ _id: id, workspaceId: ctx.workspace._id }),
      ConversationMember.exists({ conversationId: id, userId: ctx.user._id }),
    ]);
    if (!conversation || !member) throw notFound("Conversation not found");
    return conversation;
  },

  async memberIds(conversationId: Types.ObjectId | string) {
    const members = await ConversationMember.find({ conversationId }).select("userId").lean();
    return members.map((m) => m.userId.toString());
  },

  async listMembers(ctx: WorkspaceContext, id: string) {
    await this.getForMember(ctx, id);
    const ids = await this.memberIds(id);
    const users = await User.find({ _id: { $in: ids } }).select("fullName email avatarUrl").lean();
    return users
      .map((u) => ({ _id: u._id.toString(), fullName: u.fullName, email: u.email, avatarUrl: u.avatarUrl }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  },

  async joinChannel(ctx: WorkspaceContext, id: string) {
    if (!Types.ObjectId.isValid(id)) throw notFound("Channel not found");
    const channel = await Conversation.findOne({ _id: id, workspaceId: ctx.workspace._id, type: "channel" });
    // Private channels look exactly like missing ones to outsiders.
    if (!channel || channel.isPrivate) throw notFound("Channel not found");
    await join(channel, [ctx.user._id]);
    return channel;
  },

  async leave(ctx: WorkspaceContext, id: string) {
    const conversation = await this.getForMember(ctx, id);
    if (conversation.type !== "channel") throw badRequest("You can't leave a direct message");
    if (conversation.isDefault) throw badRequest(`Everyone stays in #${conversation.name}`);
    await ConversationMember.deleteOne({ conversationId: conversation._id, userId: ctx.user._id });
  },

  async addMembers(ctx: WorkspaceContext, id: string, userIds: string[]) {
    const conversation = await this.getForMember(ctx, id);
    if (conversation.type !== "channel") throw badRequest("Start a new group to add people to a conversation");
    const ids = await workspaceMemberIds(ctx, userIds);
    await join(conversation, ids);
    return ids.map(String);
  },

  /** Channel creator, or a workspace admin, can rename and set the topic. #general keeps its name. */
  async update(ctx: WorkspaceContext, id: string, input: { name?: string; topic?: string }) {
    const conversation = await this.getForMember(ctx, id);
    if (conversation.type !== "channel") throw badRequest("Only channels have a name and topic");
    const canEdit = conversation.createdBy.equals(ctx.user._id) || atLeast(ctx.membership.role, "admin");
    if (!canEdit) throw forbidden("Only the channel's creator or an admin can change it");
    const previousName = conversation.name;
    if (input.name !== undefined) {
      if (conversation.isDefault) throw badRequest(`#${conversation.name} can't be renamed`);
      const name = channelName(input.name);
      if (!name) throw badRequest("Channel names use letters, numbers and dashes");
      conversation.name = name;
    }
    if (input.topic !== undefined) conversation.topic = input.topic;
    const saved = await conversation.save().catch((err) => {
      throw isDuplicate(err) ? conflict(`#${conversation.name} already exists`) : err;
    });
    if (previousName !== saved.name) {
      auditService.record(ctx, "channel.renamed", { type: "channel", id: saved._id.toString(), label: `#${saved.name}` }, { from: `#${previousName}` });
    }
    return saved;
  },

  /** The DM (1 other person) or group (2-7 others) with exactly these people; created if new. */
  async openDirect(ctx: WorkspaceContext, userIds: string[]) {
    const others = (await workspaceMemberIds(ctx, [...new Set(userIds)])).filter((id) => !id.equals(ctx.user._id));
    if (others.length === 0) throw badRequest("Pick at least one teammate");
    if (others.length + 1 > MAX_GROUP_SIZE) throw badRequest(`Groups can have up to ${MAX_GROUP_SIZE} people`);

    const everyone = [ctx.user._id, ...others];
    const dmKey = dmKeyOf(everyone);
    const conversation = await Conversation.findOneAndUpdate(
      { workspaceId: ctx.workspace._id, dmKey },
      { $setOnInsert: { type: others.length === 1 ? "dm" : "group", isPrivate: true, createdBy: ctx.user._id } },
      { upsert: true, new: true },
    ).catch(async (err) => {
      if (!isDuplicate(err)) throw err;
      return Conversation.findOne({ workspaceId: ctx.workspace._id, dmKey });
    });
    if (!conversation) throw new Error("Could not open conversation");
    await join(conversation, everyone);
    return conversation;
  },

  async markRead(ctx: WorkspaceContext, id: string) {
    const conversation = await this.getForMember(ctx, id);
    await ConversationMember.updateOne(
      { conversationId: conversation._id, userId: ctx.user._id },
      { $set: { lastReadAt: new Date() } },
    );
    // Opening the conversation also clears its notifications.
    await Notification.updateMany(
      { userId: ctx.user._id, conversationId: conversation._id, readAt: { $exists: false } },
      { $set: { readAt: new Date() } },
    );
  },
};
