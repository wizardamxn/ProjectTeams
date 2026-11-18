import dns from "node:dns";
import mongoose from "mongoose";
import { config } from "../config.js";
import { logger } from "./logger.js";

export const connectDB = async (uri = config.MONGO_URI) => {
  if (config.DNS_SERVERS.length > 0) dns.setServers(config.DNS_SERVERS);
  await mongoose.connect(uri);
  logger.info("MongoDB connected");
};

export const disconnectDB = () => mongoose.disconnect();
