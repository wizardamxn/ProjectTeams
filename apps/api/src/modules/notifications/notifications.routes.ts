import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { ctxOf, requireWorkspace } from "../../middleware/workspace.js";
import { notificationsService } from "./notifications.service.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth, requireWorkspace);

notificationsRouter.get("/", async (req, res) => {
  res.json(await notificationsService.list(ctxOf(req)));
});

notificationsRouter.post("/read", validateBody(z.object({ ids: z.array(z.string()).max(200).optional() })), async (req, res) => {
  await notificationsService.markRead(ctxOf(req), req.body.ids);
  res.json({ ok: true });
});
