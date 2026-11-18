import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { objectId, requireObjectIds, validateBody } from "../../middleware/validate.js";
import { ctxOf, requireWorkspace } from "../../middleware/workspace.js";
import { createDocSchema, folderSchema, updateDocSchema } from "./docs.schemas.js";
import { docsService, presentDoc } from "./docs.service.js";
import { commentsService } from "./comments.service.js";

// Mounted at /api/doc (original paths kept so older clients keep working).
export const docsRouter = Router();

docsRouter.use(requireAuth, requireWorkspace);
docsRouter.param("doc_id", (req, res, next) => requireObjectIds("doc_id")(req, res, next));

const id = (v: unknown) => String(v);

docsRouter.post("/create", validateBody(createDocSchema), async (req, res) => {
  const ctx = ctxOf(req);
  const doc = await docsService.create(ctx, req.body);
  res.status(201).json({ message: "Document Created Successfully", document: presentDoc(doc, ctx, { full: true }) });
});

/** ?folderId=<id>|none &starred=1 &mine=1 */
docsRouter.get("/list", async (req, res) => {
  const ctx = ctxOf(req);
  const docs = await docsService.list(ctx, {
    folderId: typeof req.query.folderId === "string" ? req.query.folderId : undefined,
    starred: req.query.starred === "1",
    mine: req.query.mine === "1",
  });
  res.json(docs.map((d) => presentDoc(d, ctx)));
});

docsRouter.get("/viewdocs", async (req, res) => {
  const ctx = ctxOf(req);
  res.json((await docsService.list(ctx, { mine: true })).map((d) => presentDoc(d, ctx)));
});

docsRouter.get("/teamdocs", async (req, res) => {
  const ctx = ctxOf(req);
  res.json((await docsService.list(ctx)).map((d) => presentDoc(d, ctx)));
});

docsRouter.get("/starred", async (req, res) => {
  const ctx = ctxOf(req);
  res.json((await docsService.list(ctx, { starred: true })).map((d) => presentDoc(d, ctx)));
});

docsRouter.get("/doc/:doc_id", async (req, res) => {
  const ctx = ctxOf(req);
  res.json(presentDoc(await docsService.get(ctx, id(req.params.doc_id)), ctx, { full: true }));
});

docsRouter.put("/edit/:doc_id", validateBody(updateDocSchema), async (req, res) => {
  const ctx = ctxOf(req);
  res.json(presentDoc(await docsService.update(ctx, id(req.params.doc_id), req.body), ctx, { full: true }));
});

docsRouter.put("/star/:doc_id", async (req, res) => {
  const ctx = ctxOf(req);
  res.json(presentDoc(await docsService.toggleStar(ctx, id(req.params.doc_id)), ctx));
});

docsRouter.delete("/teamdocs/:doc_id", async (req, res) => {
  await docsService.remove(ctxOf(req), id(req.params.doc_id));
  res.json({ message: "Document deleted" });
});

/* ---- History ---- */

docsRouter.get("/doc/:doc_id/versions", async (req, res) => {
  res.json(await docsService.listVersions(ctxOf(req), id(req.params.doc_id)));
});

docsRouter.get("/doc/:doc_id/versions/:versionId", async (req, res) => {
  res.json(await docsService.getVersion(ctxOf(req), id(req.params.doc_id), id(req.params.versionId)));
});

docsRouter.post("/doc/:doc_id/versions/:versionId/restore", async (req, res) => {
  const ctx = ctxOf(req);
  res.json(presentDoc(await docsService.restoreVersion(ctx, id(req.params.doc_id), id(req.params.versionId)), ctx, { full: true }));
});

/* ---- Folders: /api/doc/folders ---- */

docsRouter.get("/folders", async (req, res) => {
  res.json(await docsService.listFolders(ctxOf(req)));
});

docsRouter.post("/folders", validateBody(folderSchema), async (req, res) => {
  const f = await docsService.createFolder(ctxOf(req), req.body.name);
  res.status(201).json({ _id: f._id.toString(), name: f.name, docCount: 0 });
});

docsRouter.patch("/folders/:folderId", requireObjectIds("folderId"), validateBody(folderSchema), async (req, res) => {
  const f = await docsService.renameFolder(ctxOf(req), id(req.params.folderId), req.body.name);
  res.json({ _id: f._id.toString(), name: f.name });
});

docsRouter.delete("/folders/:folderId", requireObjectIds("folderId"), async (req, res) => {
  await docsService.deleteFolder(ctxOf(req), id(req.params.folderId));
  res.json({ ok: true });
});

/* ---- Comments ---- */

const commentText = z.string({ required_error: "Write a comment" }).trim().min(1, "Write a comment").max(5000, "Comment is too long");
const newCommentSchema = z.object({
  text: commentText,
  quote: z.string().trim().max(500).optional(),
  parentId: objectId.optional(),
});
const editCommentSchema = z.object({ text: commentText });
const resolveSchema = z.object({ resolved: z.boolean() });

docsRouter.get("/doc/:doc_id/comments", async (req, res) => {
  res.json(await commentsService.list(ctxOf(req), id(req.params.doc_id)));
});

docsRouter.post("/doc/:doc_id/comments", validateBody(newCommentSchema), async (req, res) => {
  const c = await commentsService.create(ctxOf(req), id(req.params.doc_id), req.body);
  res.status(201).json({ _id: c._id.toString(), parentId: c.parentId?.toString() ?? null });
});

docsRouter.patch("/doc/:doc_id/comments/:commentId", requireObjectIds("commentId"), validateBody(editCommentSchema), async (req, res) => {
  await commentsService.edit(ctxOf(req), id(req.params.doc_id), id(req.params.commentId), req.body.text);
  res.json({ ok: true });
});

docsRouter.delete("/doc/:doc_id/comments/:commentId", requireObjectIds("commentId"), async (req, res) => {
  res.json(await commentsService.remove(ctxOf(req), id(req.params.doc_id), id(req.params.commentId)));
});

docsRouter.post("/doc/:doc_id/comments/:commentId/resolve", requireObjectIds("commentId"), validateBody(resolveSchema), async (req, res) => {
  await commentsService.setResolved(ctxOf(req), id(req.params.doc_id), id(req.params.commentId), req.body.resolved);
  res.json({ ok: true });
});
