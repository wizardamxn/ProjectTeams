import supabase from "../utils/supabase.js";
import RagDocument from "../models/ragDocument.js";
import RagChunk from "../models/ragChunk.js";
import ragQueue from "../queues/ragQueue.js";

const BUCKET = process.env.SUPABASE_BUCKET;

export const uploadDocument = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { user } = req;
    const teamId = user.teamCode;
    const storagePath = `${teamId}/${Date.now()}-${file.originalname}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError.message);
      return res.status(500).json({ error: "Failed to upload file to storage" });
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    const ragDocument = new RagDocument({
      fileName: file.originalname,
      fileUrl: publicUrlData.publicUrl,
      storagePath,
      mimeType: file.mimetype,
      fileSize: file.size,
      teamId,
      uploadedBy: user._id,
    });
    await ragDocument.save();

    res.status(201).json({ message: "Document uploaded successfully", document: ragDocument });
  } catch (err) {
    console.error("Error uploading document:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const ragifyDocument = async (req, res) => {
  try {
    const { user } = req;
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

    await ragQueue.add("process-document", {
      documentId: ragDocument._id.toString(),
      storagePath: ragDocument.storagePath,
      mimeType: ragDocument.mimeType,
    });

    res.status(202).json({ message: "Ragify started", document: ragDocument });
  } catch (err) {
    console.error("Error ragifying document:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getDocument = async (req, res) => {
  try {
    const { user } = req;
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

    res.status(200).json({ document: ragDocument, chunks });
  } catch (err) {
    console.error("Error fetching document:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteDocument = async (req, res) => {
  try {
    const { user } = req;
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
