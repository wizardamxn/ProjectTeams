import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { z, type ZodTypeAny } from "zod";
import { badRequest, notFound } from "../lib/errors.js";

/**
 * Validates and replaces `req.body` with the parsed value, so handlers only
 * ever see fields the schema allows (unknown keys are stripped).
 */
export const validateBody =
  <S extends ZodTypeAny>(schema: S) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const issue = result.error.issues[0];
      throw badRequest(issue?.message ?? "Invalid request");
    }
    req.body = result.data;
    next();
  };

/**
 * Rejects malformed ObjectIds in route params with a 404, so an id that can't
 * exist looks the same as one that doesn't.
 */
export const requireObjectIds =
  (...params: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    for (const p of params) {
      if (!mongoose.isValidObjectId(req.params[p])) throw notFound();
    }
    next();
  };

export const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), "Invalid id");
