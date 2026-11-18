import { Types } from "mongoose";
import { badRequest, conflict, forbidden, notFound } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { plainToRichText, richTextToPlain } from "../../lib/richText.js";
import { Document, type DocumentDoc } from "../../models/document.js";
import { DocumentVersion } from "../../models/documentVersion.js";
import { Folder } from "../../models/folder.js";
import { atLeast } from "../../models/membership.js";
import { RagChunk } from "../../models/ragChunk.js";
import { User } from "../../models/user.js";
import { enqueueDocIndex } from "../../queues/ragQueue.js";
import type { WorkspaceContext } from "../workspaces/workspaces.service.js";
import type { CreateDocInput, UpdateDocInput } from "./docs.schemas.js";
import { auditService } from "../audit/audit.service.js";
import { collab, docRoom } from "../collab/collab.service.js";
import { emitToRoom } from "../../realtime/emitter.js";
import { DocComment } from "../../models/docComment.js";
import { webhooks } from "../webhooks/webhooks.service.js";

// Every lookup is scoped to the active workspace. A document from another
// workspace is indistinguishable from one that doesn't exist.

/** Autosave runs every few seconds; history keeps one snapshot per editor per 10 minutes. */
const SNAPSHOT_EVERY_MS = 10 * 60 * 1000;
const EXCERPT = 300;

const reindex = (docId: Types.ObjectId) =>
  Promise.resolve()
    .then(() => enqueueDocIndex(docId.toString()))
    .catch((err) => logger.warn({ err, docId: docId.toString() }, "Could not queue doc indexing"));

/** What the client sees. Lists leave out the full content. */
export const presentDoc = (doc: DocumentDoc, ctx: WorkspaceContext, { full = false } = {}) => {
  const o = doc.toObject();
  return {
    _id: o._id.toString(),
    title: o.title,
    ...(full
      ? { contentJson: o.contentJson ?? plainToRichText(o.content), content: o.content }
      : { content: o.content.slice(0, EXCERPT) }),
    summary: o.summary ?? "",
    tags: o.tags ?? [],
    folderId: o.folderId?.toString() ?? null,
    createdBy: o.createdBy.toString(),
    lastEditedBy: o.lastEditedBy?.toString() ?? null,
    teamId: o.teamId,
    author: o.author,
    starred: (o.starredBy ?? []).some((id) => id.equals(ctx.user._id)),
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
};

/** Pre-Phase-5 data: team-wide stars become the author's star; embedded history moves to DocumentVersion. */
const upgradeLegacy = async (ctx: WorkspaceContext) => {
  await Document.updateMany(
    { teamId: ctx.key, starred: true },
    [{ $set: { starredBy: ["$createdBy"] } }, { $unset: "starred" }],
  );
};

const moveLegacyVersions = async (doc: DocumentDoc) => {
  if (!doc.versions?.length) return;
  await DocumentVersion.insertMany(
    doc.versions.map((v) => ({
      documentId: doc._id,
      teamId: doc.teamId,
      title: doc.title,
      content: v.content ?? "",
      contentJson: plainToRichText(v.content ?? ""),
      savedAt: v.updatedAt ?? doc.createdAt,
    })),
  );
  await Document.updateOne({ _id: doc._id }, { $unset: { versions: 1 } });
  doc.versions = undefined;
};

const getWorkspaceDoc = async (ctx: WorkspaceContext, id: string) => {
  if (!Types.ObjectId.isValid(id)) throw notFound("Document not found");
  const doc = await Document.findOne({ _id: id, teamId: ctx.key });
  if (!doc) throw notFound("Document not found");
  return doc;
};

const assertFolder = async (ctx: WorkspaceContext, folderId: string | null | undefined) => {
  if (!folderId) return undefined;
  const folder = await Folder.findOne({ _id: folderId, workspaceId: ctx.workspace._id });
  if (!folder) throw badRequest("Folder not found");
  return folder._id;
};

/** Rich text wins; plain text (older clients) is converted. */
const contentFields = (input: { contentJson?: Record<string, unknown>; content?: string }) => {
  if (input.contentJson) return { contentJson: input.contentJson, content: richTextToPlain(input.contentJson) };
  if (input.content !== undefined) return { contentJson: plainToRichText(input.content), content: input.content };
  return {};
};

const snapshot = (doc: DocumentDoc) =>
  DocumentVersion.create({
    documentId: doc._id,
    teamId: doc.teamId,
    title: doc.title,
    contentJson: doc.contentJson ?? plainToRichText(doc.content),
    content: doc.content,
    editedBy: doc.lastEditedBy ?? doc.createdBy,
    savedAt: doc.updatedAt,
  });

const isLive = async (docId: Types.ObjectId) => Boolean(await Document.exists({ _id: docId, ystate: { $exists: true } }));

/** Should a change by `userId` save the previous state to history first? */
const wantsSnapshot = async (doc: DocumentDoc, userId: Types.ObjectId | undefined) => {
  const latest = await DocumentVersion.findOne({ documentId: doc._id }).sort({ savedAt: -1 });
  const someoneElse = doc.lastEditedBy && userId && !doc.lastEditedBy.equals(userId);
  return !latest || Boolean(someoneElse) || Date.now() - latest.createdAt.getTime() > SNAPSHOT_EVERY_MS;
};

/**
 * Saves the body derived from live editing (called by the collab service a
 * moment after edits stop): history snapshot, plain text, reindex.
 */
export const saveDerivedContent = async (
  docId: string,
  json: Record<string, unknown>,
  userId: string | undefined,
  { snapshot: allowSnapshot = true } = {},
) => {
  const doc = await Document.findById(docId);
  if (!doc) return;
  if (JSON.stringify(doc.contentJson ?? null) === JSON.stringify(json)) return;
  const editor = userId && Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : undefined;
  await moveLegacyVersions(doc);
  if (allowSnapshot && (await wantsSnapshot(doc, editor))) await snapshot(doc);
  doc.set({ contentJson: json, content: richTextToPlain(json), ...(editor ? { lastEditedBy: editor } : {}) });
  await doc.save();
  emitToRoom(docRoom(docId), "doc:saved", { docId, updatedAt: doc.updatedAt });
  void reindex(doc._id);
};

export const docsService = {
  async create(ctx: WorkspaceContext, input: CreateDocInput) {
    const doc = await Document.create({
      title: input.title,
      ...contentFields(input),
      summary: input.summary,
      tags: input.tags ?? [],
      folderId: await assertFolder(ctx, input.folderId),
      starredBy: input.starred ? [ctx.user._id] : [],
      createdBy: ctx.user._id,
      lastEditedBy: ctx.user._id,
      teamId: ctx.key,
      author: { name: ctx.user.fullName, avatar: ctx.user.avatarUrl },
    });
    void reindex(doc._id);
    webhooks.dispatch(ctx.workspace._id, "doc.created", {
      doc: { id: doc._id.toString(), title: doc.title },
      author: { id: ctx.user._id.toString(), name: ctx.user.fullName },
    });
    return doc;
  },

  async list(ctx: WorkspaceContext, filter: { folderId?: string; starred?: boolean; mine?: boolean } = {}) {
    await upgradeLegacy(ctx);
    const q: Record<string, unknown> = { teamId: ctx.key };
    if (filter.folderId === "none") q.folderId = { $exists: false };
    else if (filter.folderId) q.folderId = filter.folderId;
    if (filter.starred) q.starredBy = ctx.user._id;
    if (filter.mine) q.createdBy = ctx.user._id;
    return Document.find(q).select("-contentJson -versions").sort({ updatedAt: -1 }).limit(500);
  },

  async get(ctx: WorkspaceContext, id: string) {
    const doc = await getWorkspaceDoc(ctx, id);
    if (!doc.starred) return doc;
    await upgradeLegacy(ctx);
    return getWorkspaceDoc(ctx, id);
  },

  async update(ctx: WorkspaceContext, id: string, input: UpdateDocInput): Promise<DocumentDoc> {
    const doc = await getWorkspaceDoc(ctx, id);
    await moveLegacyVersions(doc);

    const content = contentFields(input);
    // A doc being edited live: the body changes through the shared editing state.
    if (content.contentJson && (await isLive(doc._id))) {
      await collab.replaceContent(doc._id.toString(), content.contentJson as Record<string, unknown>, ctx.user._id.toString());
      // The body is saved; apply the rest of the change (title, tags…) on top.
      return this.update(ctx, id, { ...input, contentJson: undefined, content: undefined });
    }
    const changesText =
      (content.content !== undefined && content.content !== doc.content) ||
      (content.contentJson !== undefined && JSON.stringify(content.contentJson) !== JSON.stringify(doc.contentJson)) ||
      (input.title !== undefined && input.title !== doc.title);

    if (changesText && (await wantsSnapshot(doc, ctx.user._id))) await snapshot(doc);

    doc.set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...content,
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(input.folderId !== undefined ? { folderId: await assertFolder(ctx, input.folderId) } : {}),
      lastEditedBy: ctx.user._id,
    });
    await doc.save();
    if (changesText) void reindex(doc._id);
    return doc;
  },

  async toggleStar(ctx: WorkspaceContext, id: string) {
    const doc = await this.get(ctx, id);
    const starred = doc.starredBy.some((u) => u.equals(ctx.user._id));
    await Document.updateOne({ _id: doc._id }, starred ? { $pull: { starredBy: ctx.user._id } } : { $addToSet: { starredBy: ctx.user._id } });
    return (await Document.findById(doc._id))!;
  },

  /** Authors delete their own docs; admins and the owner can delete any. */
  async remove(ctx: WorkspaceContext, id: string) {
    const doc = await getWorkspaceDoc(ctx, id);
    const isAuthor = doc.createdBy.equals(ctx.user._id);
    if (!isAuthor && !atLeast(ctx.membership.role, "admin")) {
      throw forbidden("Only the author or a workspace admin can delete this document");
    }
    await Promise.all([
      doc.deleteOne(),
      DocumentVersion.deleteMany({ documentId: doc._id }),
      RagChunk.deleteMany({ sourceType: "doc", sourceId: doc._id }),
      DocComment.deleteMany({ docId: doc._id }),
      collab.forget([doc._id]),
    ]);
    auditService.record(ctx, "doc.deleted", { type: "doc", id: doc._id.toString(), label: doc.title });
    webhooks.dispatch(ctx.workspace._id, "doc.deleted", {
      doc: { id: doc._id.toString(), title: doc.title },
      actor: { id: ctx.user._id.toString(), name: ctx.user.fullName },
    });
  },

  /* ---- History ---- */

  async listVersions(ctx: WorkspaceContext, id: string) {
    const doc = await getWorkspaceDoc(ctx, id);
    await moveLegacyVersions(doc);
    const versions = await DocumentVersion.find({ documentId: doc._id }).select("-contentJson").sort({ savedAt: -1 }).limit(100).lean();
    const editors = await User.find({ _id: { $in: versions.flatMap((v) => v.editedBy ?? []) } }).select("fullName").lean();
    const nameOf = new Map(editors.map((e) => [e._id.toString(), e.fullName]));
    return versions.map((v) => ({
      _id: v._id.toString(),
      title: v.title,
      savedAt: v.savedAt,
      editedBy: v.editedBy ? { _id: v.editedBy.toString(), fullName: nameOf.get(v.editedBy.toString()) ?? "Former member" } : null,
      preview: v.content.slice(0, 160),
    }));
  },

  async getVersion(ctx: WorkspaceContext, id: string, versionId: string) {
    const doc = await getWorkspaceDoc(ctx, id);
    if (!Types.ObjectId.isValid(versionId)) throw notFound("Version not found");
    const v = await DocumentVersion.findOne({ _id: versionId, documentId: doc._id }).lean();
    if (!v) throw notFound("Version not found");
    return { _id: v._id.toString(), title: v.title, contentJson: v.contentJson ?? plainToRichText(v.content), savedAt: v.savedAt };
  },

  /** Puts an old version back. The current state is saved to history first, so restoring is undoable. */
  async restoreVersion(ctx: WorkspaceContext, id: string, versionId: string) {
    const doc = await getWorkspaceDoc(ctx, id);
    const v = await this.getVersion(ctx, id, versionId);
    await snapshot(doc);
    if (await isLive(doc._id)) {
      // Everyone with the doc open sees the restored text straight away.
      await collab.replaceContent(doc._id.toString(), v.contentJson as Record<string, unknown>, ctx.user._id.toString(), { snapshot: false });
      await Document.updateOne({ _id: doc._id }, { $set: { title: v.title, lastEditedBy: ctx.user._id } });
      const fresh = await getWorkspaceDoc(ctx, id);
      auditService.record(ctx, "doc.version_restored", { type: "doc", id: doc._id.toString(), label: fresh.title }, { versionId });
      return fresh;
    }
    doc.set({ title: v.title, contentJson: v.contentJson, content: richTextToPlain(v.contentJson), lastEditedBy: ctx.user._id });
    await doc.save();
    void reindex(doc._id);
    auditService.record(ctx, "doc.version_restored", { type: "doc", id: doc._id.toString(), label: doc.title }, { versionId });
    return doc;
  },

  /* ---- Folders ---- */

  async listFolders(ctx: WorkspaceContext) {
    const folders = await Folder.find({ workspaceId: ctx.workspace._id }).sort({ name: 1 }).lean();
    const counts = await Document.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { teamId: ctx.key, folderId: { $in: folders.map((f) => f._id) } } },
      { $group: { _id: "$folderId", n: { $sum: 1 } } },
    ]);
    const countOf = new Map(counts.map((c) => [c._id.toString(), c.n]));
    return folders.map((f) => ({ _id: f._id.toString(), name: f.name, docCount: countOf.get(f._id.toString()) ?? 0 }));
  },

  async createFolder(ctx: WorkspaceContext, name: string) {
    const clash = await Folder.findOne({ workspaceId: ctx.workspace._id, name }).collation({ locale: "en", strength: 2 });
    if (clash) throw conflict(`A folder called "${clash.name}" already exists`);
    try {
      return await Folder.create({ workspaceId: ctx.workspace._id, name, createdBy: ctx.user._id });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) throw conflict(`A folder called "${name}" already exists`);
      throw err;
    }
  },

  async renameFolder(ctx: WorkspaceContext, folderId: string, name: string) {
    const folder = await Folder.findOne({ _id: folderId, workspaceId: ctx.workspace._id });
    if (!folder) throw notFound("Folder not found");
    folder.name = name;
    return folder.save().catch((err) => {
      throw (err as { code?: number }).code === 11000 ? conflict(`A folder called "${name}" already exists`) : err;
    });
  },

  /** Deleting a folder keeps its docs; they move back to "No folder". */
  async deleteFolder(ctx: WorkspaceContext, folderId: string) {
    const folder = await Folder.findOne({ _id: folderId, workspaceId: ctx.workspace._id });
    if (!folder) throw notFound("Folder not found");
    const moved = await Document.updateMany({ teamId: ctx.key, folderId: folder._id }, { $unset: { folderId: 1 } });
    await folder.deleteOne();
    auditService.record(ctx, "folder.deleted", { type: "folder", id: folder._id.toString(), label: folder.name }, { docsMoved: moved.modifiedCount });
  },
};
