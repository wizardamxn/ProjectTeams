import type { Types } from "mongoose";
import { badRequest, notFound } from "../../lib/errors.js";
import { Chat } from "../../models/chat.js";
import { usersService } from "../users/users.service.js";
import type { WorkspaceContext } from "../workspaces/workspaces.service.js";

export const MAX_MESSAGE_LENGTH = 4000;

const findOrCreate = async (workspaceId: Types.ObjectId, a: Types.ObjectId, b: Types.ObjectId) => {
  const participants = [a, b].sort((x, y) => x.toString().localeCompare(y.toString()));
  const pairKey = [workspaceId, ...participants].join(":");
  const existing = await Chat.findOne({ workspaceId, participants: { $all: participants, $size: 2 } });
  if (existing) return existing;
  // Atomic upsert on the unique pairKey: concurrent callers end up with the same chat.
  return Chat.findOneAndUpdate(
    { pairKey },
    { $setOnInsert: { workspaceId, participants, pairKey } },
    { upsert: true, new: true },
  ).orFail();
};

export const chatService = {
  /** The 1:1 chat with a teammate in the active workspace. Throws 404 for anyone else. */
  async openWith(ctx: WorkspaceContext, targetUserId: unknown) {
    const teammate = await usersService.findTeammate(ctx, targetUserId);
    if (!teammate) throw notFound("Teammate not found");
    return findOrCreate(ctx.workspace._id, ctx.user._id, teammate._id);
  },

  async send(ctx: WorkspaceContext, targetUserId: unknown, text: unknown) {
    const { user } = ctx;
    if (typeof text !== "string") throw badRequest("Message is empty");
    const trimmed = text.trim();
    if (!trimmed) throw badRequest("Message is empty");
    if (trimmed.length > MAX_MESSAGE_LENGTH) throw badRequest("Message is too long");

    const chat = await this.openWith(ctx, targetUserId);
    chat.messages.push({ senderId: user._id, senderName: user.fullName, text: trimmed });
    await chat.save();

    const saved = chat.messages[chat.messages.length - 1]!;
    return {
      chatId: chat._id.toString(),
      message: {
        _id: saved._id.toString(),
        senderId: user._id.toString(),
        senderName: saved.senderName,
        text: saved.text,
        timestamp: saved.createdAt,
      },
    };
  },
};
