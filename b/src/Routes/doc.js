import express from "express";
import mongoose from "mongoose";
import authorised from "../middlewares/authorised.js";
import Document from "../models/documents.js";

const docRouter = express.Router();

// Only these fields can ever come from the client. Ownership fields
// (teamId, createdBy, author, versions) are always set by the server.
const EDITABLE_FIELDS = ["title", "content", "summary", "tags"];

const pickEditable = (body = {}) => {
  const out = {};
  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) out[field] = body[field];
  }
  if (out.tags !== undefined) {
    out.tags = Array.isArray(out.tags)
      ? out.tags.filter((t) => typeof t === "string").map((t) => t.trim()).filter(Boolean).slice(0, 20)
      : [];
  }
  return out;
};

// Look a document up inside the caller's team only. Anything else is a 404,
// so other teams' document ids are indistinguishable from missing ones.
const findTeamDoc = (req) => {
  const { doc_id } = req.params;
  if (!mongoose.isValidObjectId(doc_id)) return null;
  return Document.findOne({ _id: doc_id, teamId: req.user.teamCode });
};

const notFound = (res) => res.status(404).json({ message: "Document not found" });

docRouter.use(authorised);

docRouter.post("/create", async (req, res, next) => {
  try {
    const { user } = req;
    const fields = pickEditable(req.body);
    if (!fields.title || !fields.content) {
      return res.status(400).json({ message: "Title and content are required" });
    }

    const document = await Document.create({
      ...fields,
      starred: req.body.starred === true,
      createdBy: user._id,
      teamId: user.teamCode,
      author: { name: user.fullName },
    });

    res.status(201).json({ message: "Document Created Successfully", document });
  } catch (err) {
    next(err);
  }
});

docRouter.get("/viewdocs", async (req, res, next) => {
  try {
    const documents = await Document.find({
      createdBy: req.user._id,
      teamId: req.user.teamCode,
    }).sort({ updatedAt: -1 });
    res.status(200).json(documents);
  } catch (err) {
    next(err);
  }
});

docRouter.get("/teamdocs", async (req, res, next) => {
  try {
    const documents = await Document.find({ teamId: req.user.teamCode }).sort({ updatedAt: -1 });
    res.status(200).json(documents);
  } catch (err) {
    next(err);
  }
});

docRouter.get("/starred", async (req, res, next) => {
  try {
    const documents = await Document.find({ teamId: req.user.teamCode, starred: true }).sort({
      updatedAt: -1,
    });
    res.status(200).json(documents);
  } catch (err) {
    next(err);
  }
});

docRouter.get("/doc/:doc_id", async (req, res, next) => {
  try {
    const doc = await findTeamDoc(req);
    if (!doc) return notFound(res);
    res.status(200).json(doc);
  } catch (err) {
    next(err);
  }
});

docRouter.put("/edit/:doc_id", async (req, res, next) => {
  try {
    const doc = await findTeamDoc(req);
    if (!doc) return notFound(res);

    const fields = pickEditable(req.body);
    if (fields.content !== undefined && fields.content !== doc.content) {
      doc.versions.push({ content: doc.content, updatedAt: doc.updatedAt });
    }

    Object.assign(doc, fields);
    await doc.save();
    res.status(200).json(doc);
  } catch (err) {
    next(err);
  }
});

docRouter.put("/star/:doc_id", async (req, res, next) => {
  try {
    const doc = await findTeamDoc(req);
    if (!doc) return notFound(res);

    doc.starred = !doc.starred;
    await doc.save();
    res.status(200).json(doc);
  } catch (err) {
    next(err);
  }
});

docRouter.delete("/teamdocs/:doc_id", async (req, res, next) => {
  try {
    const doc = await findTeamDoc(req);
    if (!doc) return notFound(res);

    await doc.deleteOne();
    res.status(200).json({ message: "Document deleted" });
  } catch (err) {
    next(err);
  }
});

export default docRouter;
