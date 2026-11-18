import { Router } from "express";
import { currentUser, requireAuth } from "../../middleware/auth.js";
import { usersService } from "./users.service.js";

// Mounted at /api/profile (path kept for frontend compatibility).
export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get("/profile", (req, res) => {
  res.json(currentUser(req));
});

usersRouter.get("/auth/me", (req, res) => {
  res.json({ user: currentUser(req) });
});

usersRouter.get("/teammembers", async (req, res) => {
  res.json(await usersService.listTeammates(currentUser(req)));
});
