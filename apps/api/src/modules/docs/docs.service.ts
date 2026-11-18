import { forbidden, notFound } from "../../lib/errors.js";
import { atLeast } from "../../models/membership.js";
import { Document } from "../../models/document.js";
import type { WorkspaceContext } from "../workspaces/workspaces.service.js";
import type { CreateDocInput, UpdateDocInput } from "./docs.schemas.js";

// Every lookup is scoped to the active workspace. A document from another
// workspace is indistinguishable from one that doesn't exist.

const getWorkspaceDoc = async (ctx: WorkspaceContext, id: string) => {
  const doc = await Document.findOne({ _id: id, teamId: ctx.key });
  if (!doc) throw notFound("Document not found");
  return doc;
};

export const docsService = {
  create(ctx: WorkspaceContext, input: CreateDocInput) {
    return Document.create({
      ...input,
      starred: input.starred ?? false,
      createdBy: ctx.user._id,
      teamId: ctx.key,
      author: { name: ctx.user.fullName, avatar: ctx.user.avatarUrl },
    });
  },

  listMine(ctx: WorkspaceContext) {
    return Document.find({ createdBy: ctx.user._id, teamId: ctx.key }).sort({ updatedAt: -1 });
  },

  listTeam(ctx: WorkspaceContext) {
    return Document.find({ teamId: ctx.key }).sort({ updatedAt: -1 });
  },

  listStarred(ctx: WorkspaceContext) {
    return Document.find({ teamId: ctx.key, starred: true }).sort({ updatedAt: -1 });
  },

  get: getWorkspaceDoc,

  async update(ctx: WorkspaceContext, id: string, input: UpdateDocInput) {
    const doc = await getWorkspaceDoc(ctx, id);
    if (input.content !== undefined && input.content !== doc.content) {
      doc.versions.push({ content: doc.content, updatedAt: doc.updatedAt });
    }
    doc.set(input);
    return doc.save();
  },

  async toggleStar(ctx: WorkspaceContext, id: string) {
    const doc = await getWorkspaceDoc(ctx, id);
    doc.starred = !doc.starred;
    return doc.save();
  },

  /** Authors delete their own docs; admins and the owner can delete any. */
  async remove(ctx: WorkspaceContext, id: string) {
    const doc = await getWorkspaceDoc(ctx, id);
    const isAuthor = doc.createdBy.equals(ctx.user._id);
    if (!isAuthor && !atLeast(ctx.membership.role, "admin")) {
      throw forbidden("Only the author or a workspace admin can delete this document");
    }
    await doc.deleteOne();
  },
};
