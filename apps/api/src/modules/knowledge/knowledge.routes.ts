import { Router } from "express";
import multer from "multer";
import { badRequest, unsupported } from "../../lib/errors.js";
import { requireAuth } from "../../middleware/auth.js";
import { ctxOf, requireWorkspace } from "../../middleware/workspace.js";
import { requireObjectIds } from "../../middleware/validate.js";
import { ALLOWED_MIME_TYPES } from "./ingest.js";
import { knowledgeService } from "./knowledge.service.js";

const upload = multer({
  storage: multer.memoryStorage(), // streamed straight to object storage
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) return cb(null, true);
    cb(unsupported("Only PDF, TXT, Markdown and CSV files are supported"));
  },
});

// Mounted at /api/upload (paths kept for frontend compatibility).
export const knowledgeRouter = Router();

knowledgeRouter.use(requireAuth, requireWorkspace);
knowledgeRouter.param("id", (req, res, next) => requireObjectIds("id")(req, res, next));

knowledgeRouter.post("/document", upload.single("document"), async (req, res) => {
  if (!req.file) throw badRequest("No file uploaded");
  const document = await knowledgeService.upload(ctxOf(req), req.file);
  res.status(201).json({ message: "Document uploaded successfully", document });
});

knowledgeRouter.get("/documents", async (req, res) => {
  res.json(await knowledgeService.list(ctxOf(req)));
});

knowledgeRouter.get("/document/:id", async (req, res) => {
  res.json(await knowledgeService.get(ctxOf(req), String(req.params.id)));
});

knowledgeRouter.post("/document/:id/ragify", async (req, res) => {
  const document = await knowledgeService.startIndexing(ctxOf(req), String(req.params.id));
  res.status(202).json({ message: "Indexing started", document });
});

knowledgeRouter.delete("/document/:id", async (req, res) => {
  await knowledgeService.remove(ctxOf(req), String(req.params.id));
  res.json({ message: "Document deleted" });
});
