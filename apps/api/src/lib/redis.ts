import { Redis } from "ioredis";
import { config } from "../config.js";

let connection: Redis | undefined;

// Created on first use so the API (and tests) don't open a Redis connection
// unless something actually needs the queue.
export const getRedis = () => {
  connection ??= new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
  return connection;
};

export const closeRedis = async () => {
  if (connection) {
    await connection.quit();
    connection = undefined;
  }
};
