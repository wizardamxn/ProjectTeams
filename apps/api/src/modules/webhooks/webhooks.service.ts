import { createHmac, randomBytes, randomUUID } from "node:crypto";
import type { Types } from "mongoose";
import { config } from "../../config.js";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { Webhook, WebhookDelivery, type WebhookDoc, type WebhookEvent, type WebhookFormat } from "../../models/webhook.js";
import { Workspace } from "../../models/workspace.js";
import { WEBHOOK_RETRY, webhookQueue, type WebhookJob } from "../../queues/webhookQueue.js";
import { auditService } from "../audit/audit.service.js";
import type { WorkspaceContext } from "../workspaces/workspaces.service.js";
import { assertSafeUrl, safePost, UnsafeUrlError, type PostResult } from "./safeFetch.js";

export const MAX_WEBHOOKS = 10;
/** Failed deliveries in a row before a hook switches itself off. */
export const DISABLE_AFTER_FAILURES = 20;

const appUrl = (path: string) => `${config.APP_URL.replace(/\/$/, "")}${path}`;

/* ---------------- Payloads ---------------- */

type Data = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const clip = (s: unknown, n = 300) => {
  const t = typeof s === "string" ? s : "";
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/** One line for chat apps. `link(url, label)` formats a link for the target app. */
export const summarize = (event: WebhookEvent | "ping", data: Data, workspace: string, link: (url: string, label: string) => string, bold: (s: string) => string) => {
  switch (event) {
    case "ping":
      return `Test from Project Teams (${workspace}): this webhook works.`;
    case "message.created":
      return `${bold(data.author?.name)} in ${link(appUrl(`/chat/${data.channel?.id}`), `#${data.channel?.name}`)}: ${clip(data.message?.text)}`;
    case "doc.created":
      return `${bold(data.author?.name)} created ${link(appUrl(`/editor/${data.doc?.id}`), data.doc?.title)}`;
    case "doc.deleted":
      return `${bold(data.actor?.name)} deleted the doc "${data.doc?.title}"`;
    case "comment.created":
      return `${bold(data.author?.name)} commented on ${link(appUrl(`/editor/${data.doc?.id}`), data.doc?.title)}: ${clip(data.comment?.text)}`;
    case "member.joined":
      return `${bold(data.member?.name)} joined ${workspace}`;
    case "file.uploaded":
      return `${bold(data.actor?.name)} uploaded ${link(appUrl(`/knowledge/files/${data.file?.id}`), data.file?.name)} to Knowledge`;
  }
};

const slackEscape = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The request body for a hook's format. */
export const formatBody = (format: WebhookFormat, payload: { event: string; workspace: { name: string }; data: Data }) => {
  const event = payload.event as WebhookEvent | "ping";
  if (format === "slack") {
    // Slack mrkdwn: escape &, <, > in anything users wrote.
    const esc = (v: unknown) => slackEscape(v);
    const data = JSON.parse(JSON.stringify(payload.data, (_k, v) => (typeof v === "string" ? esc(v) : v)));
    return { text: summarize(event, data, esc(payload.workspace.name), (url, label) => `<${url}|${label}>`, (s) => `*${s}*`) };
  }
  if (format === "discord") {
    const content = summarize(event, payload.data, payload.workspace.name, (url, label) => `[${label}](<${url}>)`, (s) => `**${s}**`);
    // Never ping @everyone or anyone else from user text.
    return { content: content.slice(0, 2000), allowed_mentions: { parse: [] } };
  }
  return payload;
};

/** `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">`, like Stripe's. */
export const sign = (secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)) =>
  `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;

/* ---------------- Delivery ---------------- */

const send = async (hook: WebhookDoc, job: WebhookJob, attempt: number): Promise<PostResult> => {
  const body = JSON.stringify(formatBody(hook.format, job.payload as never));
  const result = await safePost(hook.url, body, {
    "x-projectteams-event": job.event,
    "x-projectteams-delivery": job.deliveryId,
    "x-projectteams-signature": sign(hook.secret, body),
  });

  await WebhookDelivery.create({
    webhookId: hook._id,
    workspaceId: hook.workspaceId,
    event: job.event,
    deliveryId: job.deliveryId,
    attempt,
    status: result.ok ? "success" : "failed",
    statusCode: result.statusCode,
    error: result.error,
    durationMs: result.durationMs,
  });

  if (result.ok) {
    await Webhook.updateOne({ _id: hook._id }, { $set: { lastDeliveryAt: new Date(), lastStatus: "success", failureCount: 0 } });
  } else {
    const updated = await Webhook.findOneAndUpdate(
      { _id: hook._id },
      { $set: { lastDeliveryAt: new Date(), lastStatus: "failed" }, $inc: { failureCount: 1 } },
      { new: true },
    );
    if (updated && updated.enabled && updated.failureCount >= DISABLE_AFTER_FAILURES) {
      await Webhook.updateOne(
        { _id: hook._id },
        { $set: { enabled: false, disabledReason: `Turned off after ${DISABLE_AFTER_FAILURES} failed deliveries in a row` } },
      );
    }
  }
  return result;
};

/** Worth trying again later? Network errors, timeouts, 429 and 5xx are; other 4xx aren't. */
export const isRetryable = (r: PostResult) => !r.ok && (r.statusCode === undefined || r.statusCode === 429 || r.statusCode >= 500);

export class RetryableDeliveryError extends Error {}

/** Runs one delivery attempt (from the queue worker, or inline when the queue is off). */
export const deliver = async (job: WebhookJob, attempt = 1) => {
  const hook = await Webhook.findById(job.webhookId);
  if (!hook || !hook.enabled) return null;
  const result = await send(hook, job, attempt);
  if (isRetryable(result)) throw new RetryableDeliveryError(result.error ?? "delivery failed");
  return result;
};

/* ---------------- Admin API ---------------- */

const present = (h: WebhookDoc, { showSecret = false } = {}) => ({
  _id: h._id.toString(),
  name: h.name,
  url: h.url,
  format: h.format,
  events: h.events,
  enabled: h.enabled,
  secret: showSecret ? h.secret : `${h.secret.slice(0, 10)}…`,
  lastDeliveryAt: h.lastDeliveryAt ?? null,
  lastStatus: h.lastStatus ?? null,
  failureCount: h.failureCount,
  disabledReason: h.disabledReason ?? null,
  createdAt: h.createdAt,
});

const newSecret = () => `whsec_${randomBytes(24).toString("base64url")}`;

const checkUrl = (url: string) => {
  try {
    return assertSafeUrl(url).toString();
  } catch (err) {
    throw badRequest(err instanceof UnsafeUrlError ? err.message : "Invalid URL");
  }
};

const getHook = async (ctx: WorkspaceContext, id: string) => {
  const hook = await Webhook.findOne({ _id: id, workspaceId: ctx.workspace._id });
  if (!hook) throw notFound("Webhook not found");
  return hook;
};

export interface WebhookInput {
  name: string;
  url: string;
  format: WebhookFormat;
  events: WebhookEvent[];
  enabled?: boolean;
}

export const webhooks = {
  /**
   * Sends `event` to every enabled hook in the workspace that wants it.
   * Fire-and-forget: never throws, never slows the request down.
   */
  dispatch(workspaceId: Types.ObjectId, event: WebhookEvent, data: Data) {
    void (async () => {
      const hooks = await Webhook.find({ workspaceId, enabled: true, events: event }).select("_id").lean();
      if (hooks.length === 0) return;
      const ws = await Workspace.findById(workspaceId).select("name").lean();
      const queue = webhookQueue();
      for (const h of hooks) {
        const deliveryId = randomUUID();
        const job: WebhookJob = {
          webhookId: h._id.toString(),
          deliveryId,
          event,
          payload: { id: deliveryId, event, createdAt: new Date().toISOString(), workspace: { id: workspaceId.toString(), name: ws?.name ?? "" }, data },
        };
        if (queue) await queue.add("deliver", job, { ...WEBHOOK_RETRY, jobId: deliveryId });
        else await deliver(job).catch(() => undefined); // no queue: one try, no retries
      }
    })().catch((err) => logger.error({ err, event }, "webhook dispatch failed"));
  },

  async list(ctx: WorkspaceContext) {
    const hooks = await Webhook.find({ workspaceId: ctx.workspace._id }).sort({ createdAt: 1 });
    return hooks.map((h) => present(h));
  },

  async create(ctx: WorkspaceContext, input: WebhookInput) {
    if ((await Webhook.countDocuments({ workspaceId: ctx.workspace._id })) >= MAX_WEBHOOKS) {
      throw conflict(`A workspace can have up to ${MAX_WEBHOOKS} webhooks`);
    }
    const hook = await Webhook.create({
      workspaceId: ctx.workspace._id,
      name: input.name,
      url: checkUrl(input.url),
      format: input.format,
      events: [...new Set(input.events)],
      secret: newSecret(),
      enabled: input.enabled ?? true,
      createdBy: ctx.user._id,
    });
    auditService.record(ctx, "webhook.created", { type: "webhook", id: hook._id.toString(), label: hook.name }, { url: new URL(hook.url).host, events: hook.events });
    // The full secret is shown once here (and on rotate), for setting up signature checks.
    return present(hook, { showSecret: true });
  },

  async update(ctx: WorkspaceContext, id: string, input: Partial<WebhookInput>) {
    const hook = await getHook(ctx, id);
    if (input.name !== undefined) hook.name = input.name;
    if (input.url !== undefined) hook.url = checkUrl(input.url);
    if (input.format !== undefined) hook.format = input.format;
    if (input.events !== undefined) hook.events = [...new Set(input.events)];
    if (input.enabled !== undefined) {
      hook.enabled = input.enabled;
      if (input.enabled) {
        hook.failureCount = 0;
        hook.disabledReason = undefined;
      }
    }
    await hook.save();
    auditService.record(ctx, "webhook.updated", { type: "webhook", id, label: hook.name }, { changed: Object.keys(input) });
    return present(hook);
  },

  async remove(ctx: WorkspaceContext, id: string) {
    const hook = await getHook(ctx, id);
    await Promise.all([hook.deleteOne(), WebhookDelivery.deleteMany({ webhookId: hook._id })]);
    auditService.record(ctx, "webhook.deleted", { type: "webhook", id, label: hook.name });
  },

  async rotateSecret(ctx: WorkspaceContext, id: string) {
    const hook = await getHook(ctx, id);
    hook.secret = newSecret();
    await hook.save();
    auditService.record(ctx, "webhook.updated", { type: "webhook", id, label: hook.name }, { changed: ["secret"] });
    return present(hook, { showSecret: true });
  },

  /** Sends a "ping" right now and reports what happened (works even while the hook is off). */
  async test(ctx: WorkspaceContext, id: string) {
    const hook = await getHook(ctx, id);
    const deliveryId = randomUUID();
    const job: WebhookJob = {
      webhookId: hook._id.toString(),
      deliveryId,
      event: "ping",
      payload: { id: deliveryId, event: "ping", createdAt: new Date().toISOString(), workspace: { id: ctx.key, name: ctx.workspace.name }, data: {} },
    };
    const result = await send(hook, job, 1);
    return { ok: result.ok, statusCode: result.statusCode ?? null, error: result.error ?? null, durationMs: result.durationMs };
  },

  async deliveries(ctx: WorkspaceContext, id: string) {
    const hook = await getHook(ctx, id);
    const items = await WebhookDelivery.find({ webhookId: hook._id }).sort({ _id: -1 }).limit(30).lean();
    return items.map((d) => ({
      _id: d._id.toString(),
      event: d.event,
      deliveryId: d.deliveryId,
      attempt: d.attempt,
      status: d.status,
      statusCode: d.statusCode ?? null,
      error: d.error ?? null,
      durationMs: d.durationMs,
      createdAt: d.createdAt,
    }));
  },
};
