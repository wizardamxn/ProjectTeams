import { Types } from "mongoose";
import { badRequest, forbidden, notFound } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { DocComment, type DocCommentDoc } from "../../models/docComment.js";
import { Document } from "../../models/document.js";
import { atLeast } from "../../models/membership.js";
import { Notification } from "../../models/notification.js";
import { User } from "../../models/user.js";
import { emitToRoom, emitToUsers } from "../../realtime/emitter.js";
import { docRoom } from "../collab/collab.service.js";
import { webhooks } from "../webhooks/webhooks.service.js";
import type { WorkspaceContext } from "../workspaces/workspaces.service.js";

const getDoc = async (ctx: WorkspaceContext, docId: string) => {
  if (!Types.ObjectId.isValid(docId)) throw notFound("Document not found");
  const doc = await Document.findOne({ _id: docId, teamId: ctx.key }).select("title createdBy");
  if (!doc) throw notFound("Document not found");
  return doc;
};

const getComment = async (ctx: WorkspaceContext, docId: string, commentId: string) => {
  if (!Types.ObjectId.isValid(commentId)) throw notFound("Comment not found");
  const c = await DocComment.findOne({ _id: commentId, docId, teamId: ctx.key });
  if (!c) throw notFound("Comment not found");
  return c;
};

/** Tells everyone with the doc open to refetch its comments. */
const changed = (docId: string) => emitToRoom(docRoom(docId), "doc:comments", { docId });

export const commentsService = {
  /** Every thread on the doc, oldest first, replies nested. */
  async list(ctx: WorkspaceContext, docId: string) {
    await getDoc(ctx, docId);
    const all = await DocComment.find({ docId, teamId: ctx.key }).sort({ _id: 1 }).lean();
    const users = await User.find({ _id: { $in: [...new Set(all.flatMap((c) => [c.authorId, ...(c.resolvedBy ? [c.resolvedBy] : [])]).map(String))] } })
      .select("fullName avatarUrl")
      .lean();
    const who = new Map(users.map((u) => [u._id.toString(), { _id: u._id.toString(), fullName: u.fullName, avatarUrl: u.avatarUrl }]));
    const person = (id?: Types.ObjectId) => (id ? (who.get(id.toString()) ?? { _id: id.toString(), fullName: "Former member" }) : null);
    const view = (c: (typeof all)[number]) => ({
      _id: c._id.toString(),
      author: person(c.authorId)!,
      text: c.text,
      createdAt: c.createdAt,
      editedAt: c.editedAt ?? null,
    });
    return all
      .filter((c) => !c.parentId)
      .map((root) => ({
        ...view(root),
        quote: root.quote ?? "",
        resolvedAt: root.resolvedAt ?? null,
        resolvedBy: person(root.resolvedBy),
        replies: all.filter((r) => r.parentId?.equals(root._id)).map(view),
      }));
  },

  /** A new thread (with the text it's about) or a reply. Replying reopens a resolved thread. */
  async create(ctx: WorkspaceContext, docId: string, input: { text: string; quote?: string; parentId?: string }) {
    const doc = await getDoc(ctx, docId);
    let root: DocCommentDoc | null = null;
    if (input.parentId) {
      root = await getComment(ctx, docId, input.parentId);
      if (root.parentId) throw badRequest("Reply to the thread, not to a reply");
    }
    const comment = await DocComment.create({
      docId: doc._id,
      teamId: ctx.key,
      parentId: root?._id,
      authorId: ctx.user._id,
      text: input.text,
      quote: root ? undefined : input.quote?.slice(0, 500),
    });
    if (root?.resolvedAt) {
      root.resolvedAt = undefined;
      root.resolvedBy = undefined;
      await root.save();
    }
    changed(docId);
    void this.notify(ctx, doc, comment, root).catch((err) => logger.warn({ err }, "comment notifications failed"));
    webhooks.dispatch(ctx.workspace._id, "comment.created", {
      doc: { id: docId, title: doc.title },
      comment: { id: comment._id.toString(), text: comment.text, quote: (root?.quote ?? comment.quote) || null, threadId: (root?._id ?? comment._id).toString() },
      author: { id: ctx.user._id.toString(), name: ctx.user.fullName },
    });
    return comment;
  },

  /** Doc author hears about new threads; everyone in a thread hears about replies. */
  async notify(ctx: WorkspaceContext, doc: { _id: Types.ObjectId; createdBy: Types.ObjectId }, comment: DocCommentDoc, root: DocCommentDoc | null) {
    const recipients = new Set<string>();
    if (root) {
      const thread = await DocComment.find({ $or: [{ _id: root._id }, { parentId: root._id }] }).select("authorId").lean();
      for (const c of thread) recipients.add(c.authorId.toString());
    } else {
      recipients.add(doc.createdBy.toString());
    }
    recipients.delete(ctx.user._id.toString());
    if (recipients.size === 0) return;
    const ids = [...recipients];
    await Notification.insertMany(
      ids.map((userId) => ({
        userId,
        workspaceId: ctx.workspace._id,
        type: "doc_comment",
        actorId: ctx.user._id,
        docId: doc._id,
        commentId: root?._id ?? comment._id,
        preview: comment.text.slice(0, 200),
      })),
    );
    emitToUsers(ids, "notification:new", {
      type: "doc_comment",
      docId: doc._id.toString(),
      commentId: (root?._id ?? comment._id).toString(),
      actor: { _id: ctx.user._id.toString(), fullName: ctx.user.fullName },
      preview: comment.text.slice(0, 200),
    });
  },

  async edit(ctx: WorkspaceContext, docId: string, commentId: string, text: string) {
    const c = await getComment(ctx, docId, commentId);
    if (!c.authorId.equals(ctx.user._id)) throw forbidden("You can only edit your own comments");
    c.text = text;
    c.editedAt = new Date();
    await c.save();
    changed(docId);
    return c;
  },

  /** Authors delete their own; admins can delete any. Deleting a thread's first comment deletes the thread. */
  async remove(ctx: WorkspaceContext, docId: string, commentId: string) {
    const c = await getComment(ctx, docId, commentId);
    if (!c.authorId.equals(ctx.user._id) && !atLeast(ctx.membership.role, "admin")) {
      throw forbidden("You can only delete your own comments");
    }
    await DocComment.deleteMany({ $or: [{ _id: c._id }, { parentId: c._id }] });
    changed(docId);
    return { threadDeleted: !c.parentId };
  },

  async setResolved(ctx: WorkspaceContext, docId: string, commentId: string, resolved: boolean) {
    const c = await getComment(ctx, docId, commentId);
    if (c.parentId) throw badRequest("Resolve the thread, not a reply");
    c.resolvedAt = resolved ? new Date() : undefined;
    c.resolvedBy = resolved ? ctx.user._id : undefined;
    await c.save();
    changed(docId);
    return c;
  },
};
