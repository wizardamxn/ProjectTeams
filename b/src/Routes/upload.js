import express from "express";
import multer from "multer";
import authorised from "../middlewares/authorised.js";
import {
  uploadDocument,
  ragifyDocument,
  getDocument,
  deleteDocument,
} from "../controllers/uploadController.js";
import RagDocument from "../models/ragDocument.js";

const uploadRouter = express.Router();

// Keep the file in memory (req.file.buffer) instead of writing it to disk,
// since it's immediately streamed to Supabase rather than served from this server.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

uploadRouter.post("/document", authorised, upload.single("document"), uploadDocument);

uploadRouter.post("/document/:id/ragify", authorised, ragifyDocument);

uploadRouter.get("/document/:id", authorised, getDocument);

uploadRouter.delete("/document/:id", authorised, deleteDocument);

uploadRouter.get("/documents", authorised, async (req, res) => {
  try {
    const { user } = req;
    const documents = await RagDocument.find({ teamId: user.teamCode }).sort({ createdAt: -1 });
    res.status(200).json(documents);
  } catch (err) {
    console.error("Error fetching rag documents:", err.message);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

export default uploadRouter;
