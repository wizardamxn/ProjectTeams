import type { Types } from "mongoose";
import { badRequest, notFound } from "../../lib/errors.js";
import { Chat } from "../../models/chat.js";
import type { UserDoc } from "../../models/user.js";
import { usersService } from "../users/users.service.js";

export const MAX_MESSAGE_LENGTH = 4000;

const findOrCreate = async (a: Types.ObjectId, b: Types.ObjectId) => {
  const participants = [a, b].sort((x, y) => x.toString().localeCompare(y.toString()));
  return (
    (await Chat.findOne({ participants: { $all: participants, $size: 2 } })) ??
    (await Chat.create({ participants }))
  );
};

export const chatService = {
  /** The 1:1 chat between `user` and a teammate. Throws 404 for non-teammates. */
  async openWith(user: UserDoc, targetUserId: unknown) {
    const teammate = await usersService.findTeammate(user, targetUserId);
    if (!teammate) throw notFound("Teammate not found");
    return findOrCreate(user._id, teammate._id);
  },

  async send(user: UserDoc, targetUserId: unknown, text: unknown) {
    if (typeof text !== "string") throw badRequest("Message is empty");
    const trimmed = text.trim();
    if (!trimmed) throw badRequest("Message is empty");
    if (trimmed.length > MAX_MESSAGE_LENGTH) throw badRequest("Message is too long");

    const chat = await this.openWith(user, targetUserId);
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
