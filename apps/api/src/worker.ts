import { connectDB, disconnectDB } from "./lib/db.js";
import { logger } from "./lib/logger.js";
import { closeRedis } from "./lib/redis.js";
import { RAG_QUEUE } from "./queues/ragQueue.js";
import { startRagWorker } from "./queues/ragWorker.js";

try {
  await connectDB();
} catch (err) {
  logger.fatal({ err }, "Worker failed to connect to MongoDB");
  process.exit(1);
}

const worker = startRagWorker();
logger.info(`RAG worker listening on '${RAG_QUEUE}'`);

// PM2 sends SIGTERM (see ecosystem config); let the in-flight job finish.
process.on("SIGTERM", async () => {
  await worker.close();
  await Promise.allSettled([disconnectDB(), closeRedis()]);
  process.exit(0);
});
