import { Queue } from "bullmq";
import { config } from "../config.js";
import { getRedis } from "../lib/redis.js";

export const WEBHOOK_QUEUE = "webhooks";

export interface WebhookJob {
  webhookId: string;
  deliveryId: string;
  event: string;
  /** The JSON payload (the same for every retry, so receivers can de-duplicate on `id`). */
  payload: Record<string, unknown>;
}

let queue: Queue<WebhookJob> | undefined;

/** Null when the queue is off (tests, no Redis): the caller delivers inline instead. */
export const webhookQueue = () => {
  if (config.QUEUE_DISABLED) return null;
  queue ??= new Queue<WebhookJob>(WEBHOOK_QUEUE, { connection: getRedis() });
  return queue;
};

// 5 tries over about 5 minutes (10s, 20s, 40s, 80s, 160s).
export const WEBHOOK_RETRY = { attempts: 5, backoff: { type: "exponential", delay: 10_000 }, removeOnComplete: true, removeOnFail: 200 } as const;
