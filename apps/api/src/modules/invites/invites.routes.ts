import { Router } from "express";
import { currentUser, requireAuth } from "../../middleware/auth.js";
import { notFound } from "../../lib/errors.js";
import { invitesService } from "./invites.service.js";

// Public side of invites: anyone with the link can preview it; accepting needs a login.
export const invitesRouter = Router();

const tokenOf = (raw: unknown) => {
  const token = String(raw ?? "");
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) throw notFound("This invite link is invalid or has expired");
  return token;
};

invitesRouter.get("/:token", async (req, res) => {
  res.json(await invitesService.preview(tokenOf(req.params.token)));
});

invitesRouter.post("/:token/accept", requireAuth, async (req, res) => {
  res.json(await invitesService.accept(currentUser(req), tokenOf(req.params.token)));
});
