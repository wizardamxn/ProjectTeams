import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({ message: "Not found" });
};

// The one place that turns errors into responses. Shape is always
// `{ message, code? }`; stack traces never leave the server.
export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    if (err.status >= 500) logger.error({ err, path: req.originalUrl }, err.message);
    return res.status(err.status).json({ message: err.message, code: err.code });
  }

  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "File is larger than 20 MB" : err.message;
    return res.status(400).json({ message, code: "upload_error" });
  }

  const e = err as { type?: string; status?: number; name?: string; code?: number };
  if (e.type === "entity.too.large") {
    return res.status(413).json({ message: "Request is too large", code: "too_large" });
  }
  if (e.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Malformed JSON", code: "bad_json" });
  }
  if (e.name === "ValidationError") {
    return res.status(400).json({ message: "Please check your input and try again", code: "invalid" });
  }
  if (e.code === 11000) {
    return res.status(409).json({ message: "That already exists", code: "conflict" });
  }

  logger.error({ err, method: req.method, path: req.originalUrl }, "Unhandled error");
  res.status(500).json({ message: "Something went wrong", code: "internal" });
};
