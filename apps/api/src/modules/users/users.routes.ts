import { Router } from "express";
import { currentUser, requireAuth } from "../../middleware/auth.js";
import { ctxOf, requireWorkspace } from "../../middleware/workspace.js";
import { workspacesService } from "../workspaces/workspaces.service.js";
import { usersService } from "./users.service.js";

/** GET /api/me — who you are, where you're working, and where else you could be. */
export const meRouter = Router();

meRouter.get("/", requireAuth, async (req, res) => {
  const user = currentUser(req);
  const ctx = await workspacesService.resolveActive(user);
  res.json({
    user,
    workspace: ctx ? { _id: ctx.key, name: ctx.workspace.name } : null,
    role: ctx?.membership.role ?? null,
    workspaces: await workspacesService.listForUser(user),
  });
});

// Mounted at /api/profile (paths kept for frontend compatibility).
export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get("/profile", (req, res) => {
  res.json(currentUser(req));
});

usersRouter.get("/teammembers", requireWorkspace, async (req, res) => {
  res.json(await usersService.listTeammates(ctxOf(req)));
});
