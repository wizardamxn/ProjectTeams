import mongoose from "mongoose";
import { Chat } from "../../models/chat.js";
import { User, type UserDoc } from "../../models/user.js";

export const usersService = {
  /** The target user only if they are a real teammate of `user` (never themselves). */
  async findTeammate(user: UserDoc, targetUserId: unknown) {
    if (typeof targetUserId !== "string" || !mongoose.isValidObjectId(targetUserId)) return null;
    if (targetUserId === user._id.toString()) return null;
    return User.findOne({ _id: targetUserId, teamCode: user.teamCode }).select("_id fullName");
  },

  /** Teammates, most recent conversation first; never-contacted members last. */
  async listTeammates(user: UserDoc) {
    const [members, chats] = await Promise.all([
      User.find({ teamCode: user.teamCode, _id: { $ne: user._id } })
        .select("fullName email")
        .lean(),
      Chat.find({ participants: user._id }).select("participants updatedAt").lean(),
    ]);

    const lastByUser = new Map<string, Date>();
    for (const chat of chats) {
      const other = chat.participants.find((p) => !p.equals(user._id));
      if (other) lastByUser.set(other.toString(), chat.updatedAt);
    }

    return members
      .map((m) => ({ ...m, lastMessage: lastByUser.get(m._id.toString()) ?? null }))
      .sort((a, b) => (b.lastMessage?.getTime() ?? 0) - (a.lastMessage?.getTime() ?? 0));
  },
};
