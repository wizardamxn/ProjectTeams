import { ConversationMember, Conversation } from "../../models/conversation.js";
import { Document } from "../../models/document.js";
import { Message } from "../../models/message.js";
import { RagDocument } from "../../models/ragDocument.js";
import { User } from "../../models/user.js";
import type { WorkspaceContext } from "../workspaces/workspaces.service.js";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** ~160 characters around the first place a query word appears. */
export const snippet = (text: string, q: string, size = 160) => {
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  const lower = text.toLowerCase();
  const at = words.map((w) => lower.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, at - 40);
  return `${start > 0 ? "…" : ""}${text.slice(start, start + size).replace(/\s+/g, " ").trim()}${start + size < text.length ? "…" : ""}`;
};

/**
 * Keyword search across what *you* can see in the active workspace:
 * every doc and file, and messages in conversations you're a member of.
 * Uses MongoDB text indexes, falling back to a substring match for partial words.
 */
export const searchService = {
  async search(ctx: WorkspaceContext, rawQuery: string) {
    const q = rawQuery.trim().slice(0, 100);
    if (q.length < 2) return { docs: [], files: [], messages: [] };
    const like = new RegExp(escapeRe(q), "i");

    const myConversations = await ConversationMember.find({ workspaceId: ctx.workspace._id, userId: ctx.user._id }).distinct(
      "conversationId",
    );

    const textOrLike = async <T>(textQuery: () => Promise<T[]>, likeQuery: () => Promise<T[]>) => {
      try {
        const found = await textQuery();
        return found.length ? found : await likeQuery();
      } catch {
        return likeQuery(); // text index still building
      }
    };

    const [docs, files, messages] = await Promise.all([
      textOrLike(
        () =>
          Document.find({ teamId: ctx.key, $text: { $search: q } }, { score: { $meta: "textScore" } })
            .select("title content updatedAt")
            .sort({ score: { $meta: "textScore" } })
            .limit(8)
            .lean(),
        () =>
          Document.find({ teamId: ctx.key, $or: [{ title: like }, { content: like }] })
            .select("title content updatedAt")
            .sort({ updatedAt: -1 })
            .limit(8)
            .lean(),
      ),
      RagDocument.find({ teamId: ctx.key, fileName: like }).select("fileName ragStatus createdAt").limit(5).lean(),
      textOrLike(
        () =>
          Message.find(
            { conversationId: { $in: myConversations }, deletedAt: { $exists: false }, $text: { $search: q } },
            { score: { $meta: "textScore" } },
          )
            .sort({ score: { $meta: "textScore" } })
            .limit(10)
            .lean(),
        () =>
          Message.find({ conversationId: { $in: myConversations }, deletedAt: { $exists: false }, text: like })
            .sort({ _id: -1 })
            .limit(10)
            .lean(),
      ),
    ]);

    const [senders, conversations] = await Promise.all([
      User.find({ _id: { $in: messages.map((m) => m.senderId) } }).select("fullName").lean(),
      Conversation.find({ _id: { $in: messages.map((m) => m.conversationId) } }).select("type name").lean(),
    ]);
    const senderOf = new Map(senders.map((u) => [u._id.toString(), u.fullName]));
    const convOf = new Map(conversations.map((c) => [c._id.toString(), c]));

    return {
      docs: docs.map((d) => ({ _id: d._id.toString(), title: d.title, snippet: snippet(d.content ?? "", q), updatedAt: d.updatedAt })),
      files: files.map((f) => ({ _id: f._id.toString(), fileName: f.fileName, ragStatus: f.ragStatus })),
      messages: messages.map((m) => {
        const c = convOf.get(m.conversationId.toString());
        return {
          _id: m._id.toString(),
          conversationId: m.conversationId.toString(),
          threadRootId: m.threadRootId?.toString() ?? null,
          where: c?.type === "channel" ? `#${c.name}` : "Direct message",
          sender: senderOf.get(m.senderId.toString()) ?? "Someone",
          snippet: snippet(m.text, q),
          createdAt: m.createdAt,
        };
      }),
    };
  },
};
