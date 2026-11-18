import { ConversationMember, type ConversationDoc } from "../../models/conversation.js";
import { User } from "../../models/user.js";
import type { WorkspaceContext } from "../workspaces/workspaces.service.js";

/** "#design", "a DM with Priya Nair", or "a group with Priya, Dev". */
export const conversationTitle = async (ctx: WorkspaceContext, c: ConversationDoc) => {
  if (c.type === "channel") return `#${c.name}`;
  const members = await ConversationMember.find({ conversationId: c._id, userId: { $ne: ctx.user._id } }).select("userId").lean();
  const users = await User.find({ _id: { $in: members.map((m) => m.userId) } }).select("fullName").lean();
  const names = users.map((u) => u.fullName);
  return c.type === "dm" ? `a DM with ${names[0] ?? "a former member"}` : `a group with ${names.map((n) => n.split(" ")[0]).join(", ")}`;
};
