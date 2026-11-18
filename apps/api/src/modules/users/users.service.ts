import { Chat } from "../../models/chat.js";
import type { WorkspaceContext } from "../workspaces/workspaces.service.js";
import { workspacesService } from "../workspaces/workspaces.service.js";

export const usersService = {
  /** The target user only if they are in the same workspace (never yourself). */
  async findTeammate(ctx: WorkspaceContext, targetUserId: unknown) {
    if (String(targetUserId) === ctx.user._id.toString()) return null;
    return workspacesService.findMember(ctx, targetUserId);
  },

  /** Teammates in the active workspace, most recent conversation first. */
  async listTeammates(ctx: WorkspaceContext) {
    const [members, chats] = await Promise.all([
      workspacesService.listMembers(ctx),
      Chat.find({ workspaceId: ctx.workspace._id, participants: ctx.user._id })
        .select("participants updatedAt")
        .lean(),
    ]);

    const lastByUser = new Map<string, Date>();
    for (const chat of chats) {
      const other = chat.participants.find((p) => !p.equals(ctx.user._id));
      if (other) lastByUser.set(other.toString(), chat.updatedAt);
    }

    return members
      .filter((m) => m._id !== ctx.user._id.toString())
      .map((m) => ({ ...m, lastMessage: lastByUser.get(m._id) ?? null }))
      .sort((a, b) => (b.lastMessage?.getTime() ?? 0) - (a.lastMessage?.getTime() ?? 0));
  },
};
