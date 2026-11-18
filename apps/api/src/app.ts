import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { aiRouter } from "./modules/ai/ai.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { conversationsRouter, messagesRouter } from "./modules/chat/chat.routes.js";
import { notificationsRouter } from "./modules/notifications/notifications.routes.js";
import { docsRouter } from "./modules/docs/docs.routes.js";
import { knowledgeRouter } from "./modules/knowledge/knowledge.routes.js";
import { meRouter, usersRouter } from "./modules/users/users.routes.js";
import { invitesRouter } from "./modules/invites/invites.routes.js";
import { workspacesRouter } from "./modules/workspaces/workspaces.routes.js";

/** Builds the Express app without listening, so tests can drive it directly. */
export const createApp = () => {
  const app = express();

  // Behind Nginx (and Cloudflare in prod): lets rate limits see the real client IP.
  app.set("trust proxy", config.TRUST_PROXY);

  app.use(helmet());
  // Production is same-origin (Nginx proxies /api), so CORS only matters in local dev.
  app.use(cors({ origin: config.CORS_ORIGINS, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === "/api/health" },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info"),
    }),
  );

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter);
  app.use("/api/me", meRouter);
  app.use("/api/profile", usersRouter);
  app.use("/api/workspaces", workspacesRouter);
  app.use("/api/invites", invitesRouter);
  app.use("/api/doc", docsRouter);
  app.use("/api/conversations", conversationsRouter);
  app.use("/api/messages", messagesRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/ai", aiRouter);
  app.use("/api/upload", knowledgeRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
