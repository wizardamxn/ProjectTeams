import { Worker } from "bullmq";
import { getRedis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import { deliver } from "../modules/webhooks/webhooks.service.js";
import { WEBHOOK_QUEUE, type WebhookJob } from "./webhookQueue.js";

export const startWebhookWorker = () => {
  const worker = new Worker<WebhookJob>(
    WEBHOOK_QUEUE,
    // A retryable failure throws, and BullMQ tries again with backoff.
    async (job) => {
      await deliver(job.data, job.attemptsMade + 1);
    },
    { connection: getRedis(), concurrency: 5 },
  );
  worker.on("failed", (job, err) => logger.warn({ err: err.message, webhookId: job?.data.webhookId, attempt: job?.attemptsMade }, "webhook delivery failed"));
  return worker;
};
