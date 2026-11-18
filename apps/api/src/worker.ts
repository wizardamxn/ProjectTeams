import { connectDB, disconnectDB } from "./lib/db.js";
import { logger } from "./lib/logger.js";
import { closeRedis } from "./lib/redis.js";
import { RAG_QUEUE } from "./queues/ragQueue.js";
import { startRagWorker } from "./queues/ragWorker.js";
import { WEBHOOK_QUEUE } from "./queues/webhookQueue.js";
import { startWebhookWorker } from "./queues/webhookWorker.js";

try {
  await connectDB();
} catch (err) {
  logger.fatal({ err }, "Worker failed to connect to MongoDB");
  process.exit(1);
}

const workers = [startRagWorker(), startWebhookWorker()];
logger.info(`Worker listening on '${RAG_QUEUE}' and '${WEBHOOK_QUEUE}'`);

// PM2 sends SIGTERM (see ecosystem config); let the in-flight job finish.
process.on("SIGTERM", async () => {
  await Promise.allSettled(workers.map((w) => w.close()));
  await Promise.allSettled([disconnectDB(), closeRedis()]);
  process.exit(0);
});
