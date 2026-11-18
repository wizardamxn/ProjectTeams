import { Router } from "express";
import { z } from "zod";
import { currentUser, requireAuth } from "../../middleware/auth.js";
import { aiLimiter } from "../../middleware/rateLimits.js";
import { validateBody } from "../../middleware/validate.js";
import { tooLarge } from "../../lib/errors.js";
import { aiService } from "./ai.service.js";

export const MAX_CONTENT_CHARS = 20_000;
export const MAX_QUESTION_CHARS = 1_000;

const contentSchema = z.object({
  content: z.string({ required_error: "Missing content" }).trim().min(1, "Missing content"),
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

aiRouter.post("/ask-docs", limit("question", MAX_QUESTION_CHARS), validateBody(questionSchema), async (req, res) => {
  res.json(await aiService.askDocs(currentUser(req).teamCode, req.body.question));
});
