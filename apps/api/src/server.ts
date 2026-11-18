import http from "node:http";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { connectDB, disconnectDB } from "./lib/db.js";
import { logger } from "./lib/logger.js";
import { closeRedis } from "./lib/redis.js";
import { initializeSocket } from "./realtime/socket.js";

const server = http.createServer(createApp());
const io = initializeSocket(server);

const shutdown = async (signal: string) => {
  logger.info({ signal }, "Shutting down");
  io.close();
  server.close();
  await Promise.allSettled([disconnectDB(), closeRedis()]);
  process.exit(0);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

try {
  await connectDB();
  server.listen(config.PORT, () => logger.info(`API listening on port ${config.PORT}`));
} catch (err) {
  logger.fatal({ err }, "Failed to start");
  process.exit(1);
}
