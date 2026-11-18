import { pino } from "pino";
import { config, isProd } from "../config.js";

// Structured JSON logs in production; readable output in development.
export const logger = pino({
  level: config.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.cookie",
      "req.headers.authorization",
      'res.headers["set-cookie"]',
      "*.password",
      "*.newPassword",
      "*.token",
    ],
    censor: "[redacted]",
  },
  ...(isProd || config.NODE_ENV === "test"
    ? {}
    : { transport: { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } } }),
});
