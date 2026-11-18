import { Router } from "express";
import { z } from "zod";
import { currentUser, requireAuth } from "../../middleware/auth.js";
import { requireObjectIds, validateBody } from "../../middleware/validate.js";
import { ctxOf, requireRole, requireWorkspace } from "../../middleware/workspace.js";
import { ROLES } from "../../models/membership.js";
import { INVITE_ROLES } from "../../models/invite.js";
import { invitesService } from "../invites/invites.service.js";
import { auditService, type AuditFilter } from "../audit/audit.service.js";
import { exportService } from "../export/export.service.js";
import { AUDIT_ACTIONS } from "../../models/auditEvent.js";
import { exportLimiter } from "../../middleware/rateLimits.js";
import { badRequest } from "../../lib/errors.js";
import { deleteWorkspace } from "./deleteWorkspace.js";
import { workspacesService } from "./workspaces.service.js";

const nameSchema = z.object({
  name: z.string({ required_error: "Name is required" }).trim().min(1, "Name is required").max(60, "Name is too long"),
});

const roleSchema = z.object({ role: z.enum(ROLES) });

const deleteSchema = z.object({ confirmName: z.string({ required_error: "Type the workspace name to confirm" }) });

const auditQuery = z.object({
  action: z.enum(AUDIT_ACTIONS).optional(),
  actorId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
  before: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
const parseAuditQuery = (query: unknown): AuditFilter => {
  const parsed = auditQuery.safeParse(query);
  if (!parsed.success) throw badRequest("Invalid filter");
  return parsed.data;
};

const inviteSchema = z.object({
  role: z.enum(INVITE_ROLES).default("member"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").optional(),
  expiresInDays: z.number().int().min(1).max(30).default(7),
  maxUses: z.number().int().min(1).max(1000).optional(),
});

export const workspacesRouter = Router();

workspacesRouter.use(requireAuth);

/* ---- Workspaces the user belongs to ---- */

workspacesRouter.get("/", async (req, res) => {
  res.json(await workspacesService.listForUser(currentUser(req)));
});

workspacesRouter.post("/", validateBody(nameSchema), async (req, res) => {
  const workspace = await workspacesService.create(currentUser(req), req.body.name);
  res.status(201).json({ _id: workspace._id.toString(), name: workspace.name, role: "owner" });
});

workspacesRouter.post("/:id/switch", requireObjectIds("id"), async (req, res) => {
  await workspacesService.switchTo(currentUser(req), String(req.params.id));
  res.json({ ok: true });
});

/* ---- The active workspace ---- */

const current = Router();
current.use(requireWorkspace);
workspacesRouter.use("/current", current);

current.get("/", (req, res) => {
  const ctx = ctxOf(req);
  res.json({ _id: ctx.key, name: ctx.workspace.name, role: ctx.membership.role });
});

current.patch("/", requireRole("admin"), validateBody(nameSchema), async (req, res) => {
  const ws = await workspacesService.rename(ctxOf(req), req.body.name);
  res.json({ _id: ws._id.toString(), name: ws.name });
});

/** Permanently deletes the workspace. Owner only; the body must repeat the workspace name. */
current.delete("/", requireRole("owner"), validateBody(deleteSchema), async (req, res) => {
  await deleteWorkspace(ctxOf(req), req.body.confirmName);
  res.json({ ok: true });
});

/* ---- Audit log and export (admins) ---- */

current.get("/audit", requireRole("admin"), async (req, res) => {
  res.json(await auditService.list(ctxOf(req), parseAuditQuery(req.query)));
});

current.get("/audit.csv", requireRole("admin"), async (req, res) => {
  const ctx = ctxOf(req);
  const csv = await auditService.csv(ctx, parseAuditQuery(req.query));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(csv);
});

/** Zip of the workspace. `?files=0` leaves out file contents (much smaller). */
current.get("/export", requireRole("admin"), exportLimiter, async (req, res) => {
  await exportService.workspace(ctxOf(req), res, { files: req.query.files !== "0" });
});

current.post("/leave", async (req, res) => {
  await workspacesService.leave(ctxOf(req));
  res.json({ ok: true });
});

current.get("/members", async (req, res) => {
  res.json(await workspacesService.listMembers(ctxOf(req)));
});

current.patch(
  "/members/:userId",
  requireObjectIds("userId"),
  requireRole("owner"),
  validateBody(roleSchema),
  async (req, res) => {
    await workspacesService.changeRole(ctxOf(req), String(req.params.userId), req.body.role);
    res.json({ ok: true });
  },
);

current.delete("/members/:userId", requireObjectIds("userId"), requireRole("admin"), async (req, res) => {
  await workspacesService.removeMember(ctxOf(req), String(req.params.userId));
  res.json({ ok: true });
});

/* ---- Invites (admins) ---- */

current.get("/invites", requireRole("admin"), async (req, res) => {
  res.json(await invitesService.listActive(ctxOf(req)));
});

current.post("/invites", requireRole("admin"), validateBody(inviteSchema), async (req, res) => {
  res.status(201).json(await invitesService.create(ctxOf(req), req.body));
});

current.delete("/invites/:inviteId", requireObjectIds("inviteId"), requireRole("admin"), async (req, res) => {
  await invitesService.revoke(ctxOf(req), String(req.params.inviteId));
  res.json({ ok: true });
});
