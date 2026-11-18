import { Router } from "express";
import multer from "multer";
import crypto from "node:crypto";
import { z } from "zod";
import { badRequest, unsupported } from "../../lib/errors.js";
import { storage } from "../../lib/storage.js";
import { requireAuth } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { ctxOf, requireWorkspace } from "../../middleware/workspace.js";
import { safeFileName } from "../knowledge/ingest.js";
import { conversationsService } from "./conversations.service.js";
import { attachmentPrefix, MAX_ATTACHMENTS, MAX_TEXT, messagesService } from "./messages.service.js";

export const CHAT_FILE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (CHAT_FILE_TYPES.has(file.mimetype)) return cb(null, true);
    cb(unsupported("That file type can't be shared in chat"));
  },
});

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");

const channelSchema = z.object({
  name: z.string({ required_error: "Name is required" }).min(1).max(80),
  topic: z.string().trim().max(250).optional(),
  isPrivate: z.boolean().optional(),
  memberIds: z.array(objectId).max(200).optional(),
});
const updateSchema = z.object({ name: z.string().min(1).max(80).optional(), topic: z.string().trim().max(250).optional() });
const peopleSchema = z.object({ userIds: z.array(objectId).min(1).max(200) });
const attachmentSchema = z.object({
  storagePath: z.string().min(1).max(500),
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(200),
  size: z.number().int().nonnegative(),
});
const sendSchema = z.object({
  text: z.string().max(MAX_TEXT, "Message is too long").optional(),
  threadRootId: objectId.optional(),
  mentions: z.array(objectId).max(50).optional(),
  attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS).optional(),
});
const editSchema = z.object({ text: z.string().max(MAX_TEXT, "Message is too long") });

const id = (v: unknown) => String(v);

/* ---- /api/conversations ---- */

export const conversationsRouter = Router();
conversationsRouter.use(requireAuth, requireWorkspace);

conversationsRouter.get("/", async (req, res) => {
  res.json(await conversationsService.listMine(ctxOf(req)));
});

conversationsRouter.get("/browse", async (req, res) => {
  res.json(await conversationsService.browse(ctxOf(req)));
});

conversationsRouter.post("/channels", validateBody(channelSchema), async (req, res) => {
  const channel = await conversationsService.createChannel(ctxOf(req), req.body);
  res.status(201).json({ _id: channel._id.toString(), name: channel.name });
});

conversationsRouter.post("/direct", validateBody(peopleSchema), async (req, res) => {
  const conversation = await conversationsService.openDirect(ctxOf(req), req.body.userIds);
  res.json({ _id: conversation._id.toString(), type: conversation.type });
});

conversationsRouter.patch("/:id", validateBody(updateSchema), async (req, res) => {
  const c = await conversationsService.update(ctxOf(req), id(req.params.id), req.body);
  res.json({ _id: c._id.toString(), name: c.name, topic: c.topic ?? null });
});

conversationsRouter.get("/:id/members", async (req, res) => {
  res.json(await conversationsService.listMembers(ctxOf(req), id(req.params.id)));
});

conversationsRouter.post("/:id/members", validateBody(peopleSchema), async (req, res) => {
  res.json({ added: await conversationsService.addMembers(ctxOf(req), id(req.params.id), req.body.userIds) });
});

conversationsRouter.post("/:id/join", async (req, res) => {
  const c = await conversationsService.joinChannel(ctxOf(req), id(req.params.id));
  res.json({ _id: c._id.toString() });
});

conversationsRouter.post("/:id/leave", async (req, res) => {
  await conversationsService.leave(ctxOf(req), id(req.params.id));
  res.json({ ok: true });
});

conversationsRouter.post("/:id/read", async (req, res) => {
  await conversationsService.markRead(ctxOf(req), id(req.params.id));
  res.json({ ok: true });
});

conversationsRouter.get("/:id/messages", async (req, res) => {
  const before = typeof req.query.before === "string" ? req.query.before : undefined;
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  res.json(await messagesService.list(ctxOf(req), id(req.params.id), { before, limit }));
});

conversationsRouter.post("/:id/messages", validateBody(sendSchema), async (req, res) => {
  res.status(201).json(await messagesService.send(ctxOf(req), id(req.params.id), req.body));
});

conversationsRouter.get("/:id/threads/:rootId", async (req, res) => {
  res.json(await messagesService.thread(ctxOf(req), id(req.params.id), id(req.params.rootId)));
});

/** Upload first, then send a message that references the returned file. */
conversationsRouter.post("/:id/attachments", upload.single("file"), async (req, res) => {
  const ctx = ctxOf(req);
  const conversation = await conversationsService.getForMember(ctx, id(req.params.id));
  if (!req.file) throw badRequest("No file uploaded");
  const storagePath = `${attachmentPrefix(ctx, conversation._id.toString())}${crypto.randomBytes(6).toString("hex")}-${safeFileName(req.file.originalname)}`;
  await storage.upload(storagePath, req.file.buffer, req.file.mimetype);
  res.status(201).json({
    storagePath,
    fileName: req.file.originalname.slice(0, 200),
    mimeType: req.file.mimetype,
    size: req.file.size,
  });
});

/* ---- /api/messages ---- */

export const messagesRouter = Router();
messagesRouter.use(requireAuth, requireWorkspace);

messagesRouter.patch("/:id", validateBody(editSchema), async (req, res) => {
  res.json(await messagesService.edit(ctxOf(req), id(req.params.id), req.body.text));
});

messagesRouter.delete("/:id", async (req, res) => {
  await messagesService.remove(ctxOf(req), id(req.params.id));
  res.json({ ok: true });
});

