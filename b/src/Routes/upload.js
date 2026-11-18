import express from "express";
import multer from "multer";
import authorised from "../middlewares/authorised.js";
import {
  uploadDocument,
  ragifyDocument,
  getDocument,
  deleteDocument,
  listDocuments,
} from "../controllers/uploadController.js";

const uploadRouter = express.Router();

// Keep the file in memory (req.file.buffer) instead of writing it to disk,
// since it's immediately streamed to Supabase rather than served from this server.
// Only types the RAG worker can actually read.
export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 }, // 20MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) return cb(null, true);
    const err = new Error("Only PDF, TXT, Markdown and CSV files are supported");
    err.status = 415;
    cb(err);
  },
});

uploadRouter.post("/document", authorised, upload.single("document"), uploadDocument);

uploadRouter.post("/document/:id/ragify", authorised, ragifyDocument);

uploadRouter.get("/document/:id", authorised, getDocument);

uploadRouter.delete("/document/:id", authorised, deleteDocument);

uploadRouter.get("/documents", authorised, listDocuments);

export default uploadRouter;
