import type { Response } from "express";
import type { Types } from "mongoose";
import { logger } from "../../lib/logger.js";
import { plainToRichText, richTextToMarkdown } from "../../lib/richText.js";
import { storage } from "../../lib/storage.js";
import { conflict } from "../../lib/errors.js";
import { Conversation, ConversationMember } from "../../models/conversation.js";
import { Document } from "../../models/document.js";
import { DocComment } from "../../models/docComment.js";
import { Folder } from "../../models/folder.js";
import { Membership } from "../../models/membership.js";
import { Message } from "../../models/message.js";
import { RagDocument } from "../../models/ragDocument.js";
import { User, type UserDoc } from "../../models/user.js";
import { Workspace } from "../../models/workspace.js";
import { auditService } from "../audit/audit.service.js";
import type { WorkspaceContext } from "../workspaces/workspaces.service.js";
import { json, jsonLines, safeName, sendZip } from "./zip.js";

const today = () => new Date().toISOString().slice(0, 10);

/** Workspaces with an export streaming right now (one at a time each). */
const running = new Set<string>();

type DocLean = {
  _id: Types.ObjectId;
  title: string;
  content: string;
  contentJson?: unknown;
  summary?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
};

const docMarkdown = (d: DocLean, author: string) => {
  const meta = [`<!-- Exported from Project Teams. Author: ${author}. Last edited ${d.updatedAt.toISOString()}. -->`];
  const body = richTextToMarkdown(d.contentJson ?? plainToRichText(d.content));
  return `${meta.join("\n")}\n\n# ${d.title}\n\n${body}`;
};

/** Messages for the export: oldest first, deleted ones left out. */
async function* messageRows(conversationId: Types.ObjectId, names: Map<string, string>, attachmentPath?: (msgId: string, file: string) => string) {
  const cursor = Message.find({ conversationId, deletedAt: { $exists: false } }).sort({ _id: 1 }).lean().cursor();
  for await (const m of cursor) {
    const id = m._id.toString();
    yield {
      id,
      sentAt: m.createdAt,
      author: names.get(m.senderId.toString()) ?? "Former member",
      authorId: m.senderId.toString(),
      text: m.text,
      threadRootId: m.threadRootId?.toString() ?? null,
      editedAt: m.editedAt ?? null,
      attachments: (m.attachments ?? []).map((a) => ({
        fileName: a.fileName,
        size: a.size,
        ...(attachmentPath ? { path: attachmentPath(id, a.fileName) } : {}),
      })),
    };
  }
}

const README = (workspace: string, includeFiles: boolean) => `Project Teams export: ${workspace}
Exported ${new Date().toISOString()}

workspace.json        name and export details
members.json          everyone in the workspace, with roles
docs/                 every document as Markdown, in folders; docs/index.json lists them
channels/             public channels: index.json, and one messages.jsonl per channel
                      (one JSON message per line, oldest first)
files/                Knowledge files${includeFiles ? "" : " (list only; this export was made without file contents)"}

Private channels, direct messages and group messages are not included. Each person
can download their own messages from their profile ("Download my data").
${includeFiles ? "\nIf a file could not be read from storage, it is listed in missing-files.txt.\n" : ""}`;

export const exportService = {
  /** The whole workspace (minus private conversations) as a zip, streamed. Admins only. */
  async workspace(ctx: WorkspaceContext, res: Response, opts: { files: boolean }) {
    if (running.has(ctx.key)) throw conflict("An export of this workspace is already running");
    running.add(ctx.key);
    auditService.record(ctx, "workspace.exported", { type: "workspace", id: ctx.key, label: ctx.workspace.name }, { files: opts.files });

    try {
      const wsId = ctx.workspace._id;
      const memberships = await Membership.find({ workspaceId: wsId }).lean();
      const users = await User.find({ _id: { $in: memberships.map((m) => m.userId) } }).select("fullName email").lean();
      const names = new Map(users.map((u) => [u._id.toString(), u.fullName]));
      const missing: string[] = [];

      await sendZip(res, `${safeName(ctx.workspace.name, "workspace")}-export-${today()}.zip`, async (zip) => {
        await zip.add(README(ctx.workspace.name, opts.files), "README.txt");
        await zip.add(
          json({ id: ctx.key, name: ctx.workspace.name, createdAt: ctx.workspace.createdAt, exportedAt: new Date(), exportedBy: ctx.user.fullName }),
          "workspace.json",
        );
        const roleOf = new Map(memberships.map((m) => [m.userId.toString(), m]));
        await zip.add(
          json(
            users.map((u) => ({
              id: u._id.toString(),
              name: u.fullName,
              email: u.email,
              role: roleOf.get(u._id.toString())?.role,
              joinedAt: roleOf.get(u._id.toString())?.createdAt,
            })),
          ),
          "members.json",
        );

        /* Docs */
        const folders = await Folder.find({ workspaceId: wsId }).lean();
        const folderName = new Map(folders.map((f) => [f._id.toString(), safeName(f.name, "folder")]));
        const docs = await Document.find({ teamId: ctx.key }).sort({ createdAt: 1 }).lean();
        const docIndex = [];
        for (const d of docs) {
          const dir = d.folderId ? folderName.get(d.folderId.toString()) ?? "No folder" : "No folder";
          const path = `docs/${dir}/${safeName(d.title)} (${d._id.toString().slice(-6)}).md`;
          const author = names.get(d.createdBy.toString()) ?? "Former member";
          await zip.add(docMarkdown(d as DocLean, author), path, d.updatedAt);
          docIndex.push({
            id: d._id.toString(),
            title: d.title,
            path,
            folder: d.folderId ? folders.find((f) => f._id.equals(d.folderId!))?.name ?? null : null,
            tags: d.tags ?? [],
            summary: d.summary ?? "",
            author,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
          });
        }
        await zip.add(json(docIndex), "docs/index.json");

        /* Public channels */
        const channels = await Conversation.find({ workspaceId: wsId, type: "channel", isPrivate: false }).sort({ name: 1 }).lean();
        const counts = await ConversationMember.aggregate<{ _id: Types.ObjectId; n: number }>([
          { $match: { conversationId: { $in: channels.map((c) => c._id) } } },
          { $group: { _id: "$conversationId", n: { $sum: 1 } } },
        ]);
        const countOf = new Map(counts.map((c) => [c._id.toString(), c.n]));
        await zip.add(
          json(
            channels.map((c) => ({
              id: c._id.toString(),
              name: c.name,
              topic: c.topic ?? null,
              members: countOf.get(c._id.toString()) ?? 0,
              createdAt: c.createdAt,
              path: `channels/${safeName(c.name ?? c._id.toString())}/messages.jsonl`,
            })),
          ),
          "channels/index.json",
        );
        for (const c of channels) {
          const dir = `channels/${safeName(c.name ?? c._id.toString())}`;
          const attachmentPath = opts.files ? (msgId: string, file: string) => `${dir}/attachments/${msgId}-${safeName(file, "file")}` : undefined;
          await zip.add(jsonLines(messageRows(c._id, names, attachmentPath)), `${dir}/messages.jsonl`);
          if (opts.files) {
            const withFiles = Message.find({ conversationId: c._id, deletedAt: { $exists: false }, "attachments.0": { $exists: true } })
              .select("attachments")
              .lean()
              .cursor();
            for await (const m of withFiles) {
              for (const a of m.attachments) {
                const data = await storage.download(a.storagePath).catch((err) => {
                  logger.warn({ err, path: a.storagePath }, "export: attachment missing");
                  missing.push(`${dir}: ${a.fileName}`);
                  return null;
                });
                if (data) await zip.add(data, attachmentPath!(m._id.toString(), a.fileName));
              }
            }
          }
        }

        /* Knowledge files */
        const files = await RagDocument.find({ teamId: ctx.key }).sort({ createdAt: 1 }).lean();
        const fileIndex = [];
        for (const f of files) {
          const path = `files/${f._id.toString().slice(-6)}-${safeName(f.fileName, "file")}`;
          let included = false;
          if (opts.files) {
            const data = await storage.download(f.storagePath).catch((err) => {
              logger.warn({ err, path: f.storagePath }, "export: file missing");
              missing.push(`files: ${f.fileName}`);
              return null;
            });
            if (data) {
              await zip.add(data, path, f.createdAt);
              included = true;
            }
          }
          fileIndex.push({
            id: f._id.toString(),
            fileName: f.fileName,
            size: f.fileSize,
            mimeType: f.mimeType,
            uploadedBy: names.get(f.uploadedBy.toString()) ?? "Former member",
            uploadedAt: f.createdAt,
            ...(included ? { path } : {}),
          });
        }
        await zip.add(json(fileIndex), "files/index.json");

        if (opts.files) {
          await zip.add(
            missing.length ? `These files could not be read from storage:\n\n${missing.join("\n")}\n` : "None.\n",
            "missing-files.txt",
          );
        }
      });
    } finally {
      running.delete(ctx.key);
    }
  },

  /** Everything one person has put in: profile, their docs and their messages (DMs included). */
  async personal(user: UserDoc, res: Response) {
    const memberships = await Membership.find({ userId: user._id }).lean();
    const workspaces = await Workspace.find({ _id: { $in: memberships.map((m) => m.workspaceId) } }).select("name").lean();
    const wsName = new Map(workspaces.map((w) => [w._id.toString(), w.name]));

    await sendZip(res, `my-project-teams-data-${today()}.zip`, async (zip) => {
      await zip.add(
        `Your Project Teams data\nExported ${new Date().toISOString()}\n\nprofile.json      your account\nworkspaces.json   workspaces you're in\ndocs/             documents you created, as Markdown\nmessages.jsonl    every message you've sent, in any conversation (one JSON object per line)\ncomments.jsonl    every comment you've left on a doc\n`,
        "README.txt",
      );
      await zip.add(
        json({
          id: user._id.toString(),
          name: user.fullName,
          email: user.email,
          signInMethods: [...(user.password ? ["password"] : []), ...(user.googleId ? ["google"] : [])],
          createdAt: user.createdAt,
        }),
        "profile.json",
      );
      await zip.add(
        json(memberships.map((m) => ({ workspace: wsName.get(m.workspaceId.toString()) ?? "(deleted)", role: m.role, joinedAt: m.createdAt }))),
        "workspaces.json",
      );

      const docs = await Document.find({ createdBy: user._id }).sort({ createdAt: 1 }).lean();
      for (const d of docs) {
        const ws = safeName(wsName.get(d.teamId) ?? "Other", "workspace");
        await zip.add(docMarkdown(d as DocLean, user.fullName), `docs/${ws}/${safeName(d.title)} (${d._id.toString().slice(-6)}).md`, d.updatedAt);
      }

      const conversations = new Map<string, string>();
      const label = async (id: Types.ObjectId) => {
        const key = id.toString();
        if (!conversations.has(key)) {
          const c = await Conversation.findById(id).select("type name").lean();
          conversations.set(key, !c ? "(deleted)" : c.type === "channel" ? `#${c.name}` : c.type === "dm" ? "Direct message" : "Group message");
        }
        return conversations.get(key)!;
      };
      await zip.add(
        jsonLines(
          (async function* () {
            const cursor = Message.find({ senderId: user._id, deletedAt: { $exists: false } }).sort({ _id: 1 }).lean().cursor();
            for await (const m of cursor) {
              yield {
                id: m._id.toString(),
                sentAt: m.createdAt,
                workspace: wsName.get(m.workspaceId.toString()) ?? "(deleted)",
                conversation: await label(m.conversationId),
                text: m.text,
                inThread: Boolean(m.threadRootId),
                attachments: (m.attachments ?? []).map((a) => a.fileName),
              };
            }
          })(),
        ),
        "messages.jsonl",
      );

      const docTitles = new Map<string, string>();
      await zip.add(
        jsonLines(
          (async function* () {
            const cursor = DocComment.find({ authorId: user._id }).sort({ _id: 1 }).lean().cursor();
            for await (const c of cursor) {
              const key = c.docId.toString();
              if (!docTitles.has(key)) docTitles.set(key, (await Document.findById(c.docId).select("title").lean())?.title ?? "(deleted)");
              yield {
                id: c._id.toString(),
                createdAt: c.createdAt,
                workspace: wsName.get(c.teamId) ?? "(deleted)",
                doc: docTitles.get(key),
                text: c.text,
                quote: c.quote ?? null,
                isReply: Boolean(c.parentId),
              };
            }
          })(),
        ),
        "comments.jsonl",
      );
    });
  },
};
