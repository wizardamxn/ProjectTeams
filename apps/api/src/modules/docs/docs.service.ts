import { notFound } from "../../lib/errors.js";
import { Document } from "../../models/document.js";
import type { UserDoc } from "../../models/user.js";
import type { CreateDocInput, UpdateDocInput } from "./docs.schemas.js";

// Every lookup is scoped to the caller's team. A document from another team
// is indistinguishable from one that doesn't exist.

const getTeamDoc = async (user: UserDoc, id: string) => {
  const doc = await Document.findOne({ _id: id, teamId: user.teamCode });
  if (!doc) throw notFound("Document not found");
  return doc;
};

export const docsService = {
  create(user: UserDoc, input: CreateDocInput) {
    return Document.create({
      ...input,
      starred: input.starred ?? false,
      createdBy: user._id,
      teamId: user.teamCode,
      author: { name: user.fullName },
    });
  },

  listMine(user: UserDoc) {
    return Document.find({ createdBy: user._id, teamId: user.teamCode }).sort({ updatedAt: -1 });
  },

  listTeam(user: UserDoc) {
    return Document.find({ teamId: user.teamCode }).sort({ updatedAt: -1 });
  },

  listStarred(user: UserDoc) {
    return Document.find({ teamId: user.teamCode, starred: true }).sort({ updatedAt: -1 });
  },

  get: getTeamDoc,

  async update(user: UserDoc, id: string, input: UpdateDocInput) {
    const doc = await getTeamDoc(user, id);
    if (input.content !== undefined && input.content !== doc.content) {
      doc.versions.push({ content: doc.content, updatedAt: doc.updatedAt });
    }
    doc.set(input);
    return doc.save();
  },

  async toggleStar(user: UserDoc, id: string) {
    const doc = await getTeamDoc(user, id);
    doc.starred = !doc.starred;
    return doc.save();
  },

  async remove(user: UserDoc, id: string) {
    const doc = await getTeamDoc(user, id);
    await doc.deleteOne();
  },
};
