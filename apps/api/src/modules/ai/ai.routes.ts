import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { ctxOf, requireWorkspace } from "../../middleware/workspace.js";
import { aiLimiter } from "../../middleware/rateLimits.js";
import { validateBody } from "../../middleware/validate.js";
import { tooLarge } from "../../lib/errors.js";
import { aiService } from "./ai.service.js";

export const MAX_CONTENT_CHARS = 20_000;
export const MAX_QUESTION_CHARS = 1_000;

const contentSchema = z.object({
  content: z.string({ required_error: "Missing content" }).trim().min(1, "Missing content"),
});
const catchUpSchema = z.object({
  conversationId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid conversation"),
  since: z.string().datetime({ offset: true }).optional(),
});
const threadDocSchema = z.object({
  conversationId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid conversation"),
  rootId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid thread"),
});

const questionSchema = z.object({
  question: z.string({ required_error: "Missing question" }).trim().min(1, "Missing question"),
});

// Size limits are 413s, not 400s, so they're checked outside zod.
const limit = (field: "content" | "question", max: number) =>
  ((req, _res, next) => {
    if (typeof req.body?.[field] === "string" && req.body[field].length > max) {
      throw tooLarge(`${field === "content" ? "Content" : "Question"} is longer than ${max} characters`);
    }
    next();
  }) satisfies import("express").RequestHandler;

export const aiRouter = Router();

// Every AI call costs money: logged-in users only, rate limited per user.
aiRouter.use(requireAuth, aiLimiter);

aiRouter.post("/summarize", limit("content", MAX_CONTENT_CHARS), validateBody(contentSchema), async (req, res) => {
  res.json({ summary: await aiService.summarize(req.body.content) });
});

aiRouter.post("/generate-tags", limit("content", MAX_CONTENT_CHARS), validateBody(contentSchema), async (req, res) => {
  res.json({ tags: await aiService.generateTags(req.body.content) });
});

aiRouter.post("/improve-writing", limit("content", MAX_CONTENT_CHARS), validateBody(contentSchema), async (req, res) => {
  res.json({ improvedText: await aiService.improveWriting(req.body.content) });
});

aiRouter.post("/ask-docs", requireWorkspace, limit("question", MAX_QUESTION_CHARS), validateBody(questionSchema), async (req, res) => {
  res.json(await aiService.askDocs(ctxOf(req), req.body.question));
});

aiRouter.post("/catch-up", requireWorkspace, validateBody(catchUpSchema), async (req, res) => {
  const { conversationId, since } = req.body as z.infer<typeof catchUpSchema>;
  res.json(await aiService.catchUp(ctxOf(req), conversationId, since ? new Date(since) : undefined));
});

aiRouter.post("/thread-to-doc", requireWorkspace, validateBody(threadDocSchema), async (req, res) => {
  const { conversationId, rootId } = req.body as z.infer<typeof threadDocSchema>;
  res.status(201).json(await aiService.threadToDoc(ctxOf(req), conversationId, rootId));
});
