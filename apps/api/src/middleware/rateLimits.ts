import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import type { Request, Response } from "express";
import { config, isTest } from "../config.js";

const reply = (message: string) => (_req: Request, res: Response) =>
  res.status(429).json({ message });

// Login / register / password reset: per IP, to slow down credential stuffing.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skip: () => isTest,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: reply("Too many attempts. Try again in a few minutes."),
});

// AI endpoints: per logged-in user (falls back to IP), to cap model spend.
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: config.AI_REQUESTS_PER_HOUR,
  skip: () => isTest,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => (req.user ? `user:${req.user._id}` : ipKeyGenerator(req.ip ?? "")),
  handler: reply("AI limit reached. Try again later."),
});
