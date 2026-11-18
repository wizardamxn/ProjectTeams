import type { NextFunction, Request, Response } from "express";
import { AppError, forbidden } from "../lib/errors.js";
import { atLeast, type Role } from "../models/membership.js";
import { workspacesService, type WorkspaceContext } from "../modules/workspaces/workspaces.service.js";
import { currentUser } from "./auth.js";

/**
 * Resolves the user's active workspace. Mount after `requireAuth` on every
 * route that reads or writes workspace data. 409 `no_workspace` tells the
 * frontend to send the user to onboarding.
 */
export const requireWorkspace = async (req: Request, _res: Response, next: NextFunction) => {
  const ctx = await workspacesService.resolveActive(currentUser(req));
  if (!ctx) throw new AppError(409, "Create or join a workspace first", "no_workspace");
  req.ctx = { ...ctx, ip: req.ip };
  next();
};

export const requireRole =
  (min: Role) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.ctx || !atLeast(req.ctx.membership.role, min)) {
      throw forbidden(`Only workspace ${min === "owner" ? "owners" : "admins"} can do that`);
    }
    next();
  };

/** The workspace context. Only call behind `requireWorkspace`. */
export const ctxOf = (req: Request): WorkspaceContext => {
  if (!req.ctx) throw new AppError(409, "Create or join a workspace first", "no_workspace");
  return req.ctx;
};
