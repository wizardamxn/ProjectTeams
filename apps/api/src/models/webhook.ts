import mongoose, { Schema, type HydratedDocument, type Types } from "mongoose";

export const WEBHOOK_EVENTS = [
  "message.created",
  "doc.created",
  "doc.deleted",
  "comment.created",
  "member.joined",
  "file.uploaded",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** json: our signed payload. slack/discord: a message their incoming webhooks accept. */
export const WEBHOOK_FORMATS = ["json", "slack", "discord"] as const;
export type WebhookFormat = (typeof WEBHOOK_FORMATS)[number];

export interface IWebhook {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  name: string;
  url: string;
  format: WebhookFormat;
  events: WebhookEvent[];
  /** HMAC key for the X-ProjectTeams-Signature header. */
  secret: string;
  enabled: boolean;
  createdBy: Types.ObjectId;
  lastDeliveryAt?: Date;
  lastStatus?: "success" | "failed";
  /** Failures in a row; the hook switches itself off at a limit. */
  failureCount: number;
  disabledReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type WebhookDoc = HydratedDocument<IWebhook>;

const webhookSchema = new Schema<IWebhook>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    name: { type: String, required: true, maxLength: 80 },
    url: { type: String, required: true, maxLength: 2000 },
    format: { type: String, enum: WEBHOOK_FORMATS, default: "json" },
    events: [{ type: String, enum: WEBHOOK_EVENTS }],
    secret: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    lastDeliveryAt: { type: Date },
    lastStatus: { type: String, enum: ["success", "failed"] },
    failureCount: { type: Number, default: 0 },
    disabledReason: { type: String },
  },
  { timestamps: true },
);

webhookSchema.index({ workspaceId: 1, enabled: 1, events: 1 });

export const Webhook = mongoose.model<IWebhook>("Webhook", webhookSchema);

export interface IWebhookDelivery {
  _id: Types.ObjectId;
  webhookId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  event: WebhookEvent | "ping";
  deliveryId: string;
  attempt: number;
  status: "success" | "failed";
  statusCode?: number;
  error?: string;
  durationMs: number;
  createdAt: Date;
}

const deliverySchema = new Schema<IWebhookDelivery>(
  {
    webhookId: { type: Schema.Types.ObjectId, ref: "Webhook", required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    event: { type: String, required: true },
    deliveryId: { type: String, required: true },
    attempt: { type: Number, default: 1 },
    status: { type: String, enum: ["success", "failed"], required: true },
    statusCode: { type: Number },
    error: { type: String, maxLength: 500 },
    durationMs: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

deliverySchema.index({ webhookId: 1, _id: -1 });
deliverySchema.index({ workspaceId: 1 });
// Delivery logs are for debugging; two weeks is plenty.
deliverySchema.index({ createdAt: 1 }, { expireAfterSeconds: 14 * 24 * 3600 });

export const WebhookDelivery = mongoose.model<IWebhookDelivery>("WebhookDelivery", deliverySchema);
