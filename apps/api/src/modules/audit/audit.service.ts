import { Types } from "mongoose";
import { logger } from "../../lib/logger.js";
import { AuditEvent, type AuditAction, type IAuditEvent } from "../../models/auditEvent.js";
import type { WorkspaceContext } from "../workspaces/workspaces.service.js";

export interface AuditTarget {
  type: "workspace" | "member" | "invite" | "channel" | "doc" | "folder" | "file" | "webhook";
  id?: string;
  label?: string;
}

export interface AuditFilter {
  action?: AuditAction;
  actorId?: string;
  /** Cursor: only events older than this event id. */
  before?: string;
  limit?: number;
}

const write = (event: Omit<IAuditEvent, "_id" | "createdAt">) =>
  AuditEvent.create(event).catch((err) => logger.error({ err, action: event.action }, "audit write failed"));

const present = (e: IAuditEvent) => ({
  _id: e._id.toString(),
  action: e.action,
  actor: { _id: e.actorId?.toString() ?? null, name: e.actorName },
  target: e.target ?? null,
  meta: e.meta ?? null,
  ip: e.ip ?? null,
  createdAt: e.createdAt,
});
export type AuditEventView = ReturnType<typeof present>;

const query = (ctx: WorkspaceContext, filter: AuditFilter) => {
  const q: Record<string, unknown> = { workspaceId: ctx.workspace._id };
  if (filter.action) q.action = filter.action;
  if (filter.actorId && Types.ObjectId.isValid(filter.actorId)) q.actorId = new Types.ObjectId(filter.actorId);
  if (filter.before && Types.ObjectId.isValid(filter.before)) q._id = { $lt: new Types.ObjectId(filter.before) };
  return q;
};

/** A CSV cell. Quotes when needed, and defuses spreadsheet formulas (=, +, -, @). */
export const csvCell = (value: unknown) => {
  let s = value === null || value === undefined ? "" : value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const CSV_MAX_ROWS = 10_000;

export const auditService = {
  /**
   * Records something an admin may want to look back on. Never throws and
   * never blocks the request: a failed write is logged, not surfaced.
   */
  record(ctx: WorkspaceContext, action: AuditAction, target?: AuditTarget, meta?: Record<string, unknown>) {
    void write({
      workspaceId: ctx.workspace._id,
      actorId: ctx.user._id,
      actorName: ctx.user.fullName,
      action,
      target,
      meta,
      ip: ctx.ip,
    });
  },

  /** For events outside a workspace context (e.g. joining through an invite). */
  recordFor(
    workspaceId: Types.ObjectId,
    actor: { _id: Types.ObjectId; fullName: string },
    action: AuditAction,
    target?: AuditTarget,
    meta?: Record<string, unknown>,
    ip?: string,
  ) {
    void write({ workspaceId, actorId: actor._id, actorName: actor.fullName, action, target, meta, ip });
  },

  async list(ctx: WorkspaceContext, filter: AuditFilter) {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 100);
    const events = await AuditEvent.find(query(ctx, filter)).sort({ _id: -1 }).limit(limit + 1).lean();
    const page = events.slice(0, limit);
    return {
      items: page.map(present),
      nextCursor: events.length > limit ? page[page.length - 1]!._id.toString() : null,
    };
  },

  async csv(ctx: WorkspaceContext, filter: AuditFilter) {
    const events = await AuditEvent.find(query(ctx, filter)).sort({ _id: -1 }).limit(CSV_MAX_ROWS).lean();
    const header = ["time", "actor", "actor_id", "action", "target_type", "target", "target_id", "details", "ip"];
    const rows = events.map((e) =>
      [
        e.createdAt,
        e.actorName,
        e.actorId?.toString() ?? "",
        e.action,
        e.target?.type ?? "",
        e.target?.label ?? "",
        e.target?.id ?? "",
        e.meta ? JSON.stringify(e.meta) : "",
        e.ip ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
    return [header.join(","), ...rows].join("\r\n") + "\r\n";
  },
};
