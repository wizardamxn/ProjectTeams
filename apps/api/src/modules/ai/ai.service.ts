import { Types } from "mongoose";
import { z } from "zod";
import { generate } from "../../lib/ai.js";
import { notFound } from "../../lib/errors.js";
import { blocksToRichText, type DraftBlock } from "../../lib/richText.js";
import { Message } from "../../models/message.js";
import { User } from "../../models/user.js";
import { conversationsService } from "../chat/conversations.service.js";
import { conversationTitle } from "../chat/titles.js";
import { messagesService } from "../chat/messages.service.js";
import { docsService } from "../docs/docs.service.js";
import { knowledgeService } from "../knowledge/knowledge.service.js";
import type { WorkspaceContext } from "../workspaces/workspaces.service.js";

const SUMMARIZE_PROMPT = `
You are a text summarizer.
Summarize the text you receive in two concise sentences.
Return only the summary. Do not say "here is a summary".
Highlight relevant phrases in bold.`;

const TAGS_PROMPT = `
You are a keyword extraction tool.
Return 5 to 7 relevant tags for the text as a JSON array of strings, e.g. ["React", "Web Dev", "API"].
Return only the JSON array: no other text, no markdown.`;

const IMPROVE_PROMPT = `
You are a professional editor and proofreader.
Correct grammar, spelling and punctuation, and smooth the sentence flow,
strictly keeping the original meaning and tone.
Return ONLY the corrected text, with no conversational filler.`;

const CATCH_UP_PROMPT = `
Someone is catching up on a team chat they missed. From the transcript, write
3 to 6 short bullets ("- ") covering: decisions made, questions or requests
waiting on specific people (name them), and action items with owners.
Skip small talk. Use only the transcript. No intro line.`;

const THREAD_DOC_PROMPT = `
Turn this chat thread into a short, well-organised document for the team's wiki.
Respond with ONLY a JSON object, no markdown fences:
{"title": string (max 80 chars),
 "blocks": [ {"type": "heading", "text": string}
           | {"type": "paragraph", "text": string}
           | {"type": "bullets", "items": [string]}
           | {"type": "tasks", "items": [string]} ]}
Include: a one-paragraph summary, key points or decisions, and open action items (as tasks, with owners).
Use only facts from the thread.`;

/** Models sometimes wrap JSON in code fences or answer with a plain list. */
export const parseTags = (raw: string): string[] => {
  const cleaned = raw.replace(/```(?:json)?/g, "").trim();
  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed.filter((t): t is string => typeof t === "string");
  } catch {
    /* fall through to comma split */
  }
  return cleaned
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((t) => t.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
};

const draftSchema = z.object({
  title: z.string().min(1).max(200),
  blocks: z
    .array(
      z.object({
        type: z.enum(["heading", "paragraph", "bullets", "tasks"]),
        text: z.string().max(4000).optional(),
        items: z.array(z.string().max(1000)).max(50).optional(),
      }),
    )
    .max(60),
});

/** The model's JSON, or a plain fallback so the user still gets a doc. */
export const parseDraft = (raw: string, fallbackTitle: string): { title: string; blocks: DraftBlock[] } => {
  const cleaned = raw.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  try {
    const parsed = draftSchema.safeParse(JSON.parse(cleaned.slice(start, end + 1)));
    if (parsed.success) return parsed.data;
  } catch {
    /* fall through */
  }
  return {
    title: fallbackTitle,
    blocks: cleaned
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((text) => ({ type: "paragraph" as const, text })),
  };
};

const transcript = async (messages: { senderId: Types.ObjectId | string; text: string; createdAt: Date | string }[]) => {
  const ids = [...new Set(messages.map((m) => m.senderId.toString()))];
  const users = await User.find({ _id: { $in: ids } }).select("fullName").lean();
  const nameOf = new Map(users.map((u) => [u._id.toString(), u.fullName]));
  return messages
    .filter((m) => m.text)
    .map((m) => `${nameOf.get(m.senderId.toString()) ?? "Someone"} (${new Date(m.createdAt).toISOString().slice(0, 16).replace("T", " ")}): ${m.text}`)
    .join("\n");
};

export const aiService = {
  summarize: (content: string) => generate({ system: SUMMARIZE_PROMPT, prompt: content }),

  async generateTags(content: string) {
    return parseTags(await generate({ system: TAGS_PROMPT, prompt: content })).slice(0, 10);
  },

  improveWriting: (content: string) => generate({ system: IMPROVE_PROMPT, prompt: content }),

  askDocs: (ctx: WorkspaceContext, question: string) => knowledgeService.ask(ctx, question),

  /** "What did I miss?": a summary of a conversation since a point in time (default: last 24 hours). */
  async catchUp(ctx: WorkspaceContext, conversationId: string, since?: Date) {
    const conversation = await conversationsService.getForMember(ctx, conversationId);
    const from = since ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
    const messages = await Message.find({
      conversationId: conversation._id,
      deletedAt: { $exists: false },
      createdAt: { $gte: from },
    })
      .sort({ _id: -1 })
      .limit(200)
      .lean();
    if (messages.length === 0) return { summary: null, count: 0, since: from };
    const text = await transcript(messages.reverse());
    const summary = await generate({ system: CATCH_UP_PROMPT, prompt: text });
    return { summary, count: messages.length, since: from };
  },

  /** Writes a doc from a chat thread and saves it to the workspace. */
  async threadToDoc(ctx: WorkspaceContext, conversationId: string, rootId: string) {
    const conversation = await conversationsService.getForMember(ctx, conversationId);
    const thread = await messagesService.thread(ctx, conversationId, rootId);
    if (thread.root.deleted) throw notFound("Thread not found");
    const all = [thread.root, ...thread.replies].filter((m) => !m.deleted);
    const text = all.map((m) => `${m.sender.fullName} (${new Date(m.createdAt).toISOString().slice(0, 16).replace("T", " ")}): ${m.text}`).join("\n");

    const where = await conversationTitle(ctx, conversation);
    const draft = parseDraft(await generate({ system: THREAD_DOC_PROMPT, prompt: text }), `Notes from ${where}`);
    const contentJson = blocksToRichText([
      ...draft.blocks,
      { type: "paragraph", text: `Written from a thread in ${where} on ${new Date(thread.root.createdAt).toDateString()}.` },
    ]);
    const doc = await docsService.create(ctx, {
      title: draft.title.slice(0, 200),
      contentJson: contentJson as unknown as Record<string, unknown>,
      tags: ["from-chat"],
    });
    return { _id: doc._id.toString(), title: doc.title };
  },
};
