import { rateLimit, ipKeyGenerator } from "express-rate-limit";

const json = (message) => (req, res) => res.status(429).json({ message });

// Login / register / password reset: per IP, to slow down credential stuffing.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: json("Too many attempts. Try again in a few minutes."),
});

// AI endpoints: per logged-in user (falls back to IP), to cap model spend.
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.AI_REQUESTS_PER_HOUR || 60),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => (req.user ? `user:${req.user._id}` : ipKeyGenerator(req.ip)),
  handler: json("AI limit reached. Try again later."),
});
