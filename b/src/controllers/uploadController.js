import mongoose from "mongoose";
import supabase from "../utils/supabase.js";
import RagDocument from "../models/ragDocument.js";
import RagChunk from "../models/ragChunk.js";
import ragQueue from "../queues/ragQueue.js";

const BUCKET = process.env.SUPABASE_BUCKET;
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

// Storage keys must not carry user-controlled path characters.
const safeFileName = (name) =>
  name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^[._]+/, "")
    .slice(-100) || "file";

// The bucket is private; every response gets a short-lived signed URL instead
// of a permanent public link.
const withSignedUrls = async (docs) => {
  const list = Array.isArray(docs) ? docs : [docs];
  if (list.length === 0) return [];
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(list.map((d) => d.storagePath), SIGNED_URL_TTL_SECONDS);
  if (error) console.error("Signed URL error:", error.message);
  return list.map((d, i) => ({
    ...d.toObject(),
    fileUrl: data?.[i]?.signedUrl ?? null,
  }));
};

const isValidId = (id) => mongoose.isValidObjectId(id);

export const uploadDocument = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { user } = req;
    const teamId = user.teamCode;
    const storagePath = `${teamId}/${Date.now()}-${safeFileName(file.originalname)}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError.message);
      return res.status(500).json({ error: "Failed to upload file to storage" });
    }

    const ragDocument = new RagDocument({
      fileName: file.originalname.slice(0, 200),
      fileUrl: storagePath, // legacy field; real links are signed per request
      storagePath,
      mimeType: file.mimetype,
      fileSize: file.size,
      teamId,
      uploadedBy: user._id,
    });
    await ragDocument.save();

    const [document] = await withSignedUrls(ragDocument);
    res.status(201).json({ message: "Document uploaded successfully", document });
  } catch (err) {
    console.error("Error uploading document:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const ragifyDocument = async (req, res) => {
  try {
    const { user } = req;
    if (!isValidId(req.params.id)) {
      return res.status(404).json({ error: "Document not found" });
    }
    const ragDocument = await RagDocument.findOne({
      _id: req.params.id,
      teamId: user.teamCode,
    });

    if (!ragDocument) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (["processing", "ready"].includes(ragDocument.ragStatus)) {
      return res.status(409).json({ error: `Document is already ${ragDocument.ragStatus}` });
    }

    await ragQueue.add(
      "process-document",
      {
        documentId: ragDocument._id.toString(),
        storagePath: ragDocument.storagePath,
        mimeType: ragDocument.mimeType,
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );

    res.status(202).json({ message: "Ragify started", document: ragDocument });
  } catch (err) {
    console.error("Error ragifying document:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getDocument = async (req, res) => {
  try {
    const { user } = req;
    if (!isValidId(req.params.id)) {
      return res.status(404).json({ error: "Document not found" });
    }
    const ragDocument = await RagDocument.findOne({
      _id: req.params.id,
      teamId: user.teamCode,
    });

    if (!ragDocument) {
      return res.status(404).json({ error: "Document not found" });
    }

    const chunks = await RagChunk.find({ documentId: ragDocument._id })
      .select("chunkIndex text")
      .sort({ chunkIndex: 1 });

    const [document] = await withSignedUrls(ragDocument);
    res.status(200).json({ document, chunks });
  } catch (err) {
    console.error("Error fetching document:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteDocument = async (req, res) => {
  try {
    const { user } = req;
    if (!isValidId(req.params.id)) {
      return res.status(404).json({ error: "Document not found" });
    }
    const ragDocument = await RagDocument.findOne({
      _id: req.params.id,
      teamId: user.teamCode,
    });

    if (!ragDocument) {
      return res.status(404).json({ error: "Document not found" });
    }

    await RagChunk.deleteMany({ documentId: ragDocument._id });

    const { error: removeError } = await supabase.storage
      .from(BUCKET)
      .remove([ragDocument.storagePath]);
    if (removeError) {
      console.error("Error removing file from storage:", removeError.message);
    }

    await ragDocument.deleteOne();

    res.status(200).json({ message: "Document deleted" });
  } catch (err) {
    console.error("Error deleting document:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const listDocuments = async (req, res) => {
  try {
    const documents = await RagDocument.find({ teamId: req.user.teamCode }).sort({ createdAt: -1 });
    res.status(200).json(await withSignedUrls(documents));
  } catch (err) {
    console.error("Error fetching rag documents:", err.message);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
};
