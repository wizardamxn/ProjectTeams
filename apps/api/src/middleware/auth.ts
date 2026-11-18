import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { config } from "../config.js";
import { unauthorized } from "../lib/errors.js";
import { User, type UserDoc } from "../models/user.js";

export const AUTH_COOKIE = "token";

// Shared by HTTP requests and the Socket.IO handshake so both authenticate
// exactly the same way.
export const getUserFromToken = async (token: string | undefined): Promise<UserDoc | null> => {
  if (!token) return null;

  let payload: jwt.JwtPayload;
  try {
    const decoded = jwt.verify(token, config.JWT_KEY);
    if (typeof decoded === "string") return null;
    payload = decoded;
  } catch {
    return null;
  }

  if (!mongoose.isValidObjectId(payload._id)) return null;
  const user = await User.findById(payload._id);
  if (!user) return null;

  // A password change/reset invalidates every token issued before it.
  if (user.passwordChangedAt && (payload.iat ?? 0) * 1000 < user.passwordChangedAt.getTime() - 1000) {
    return null;
  }

  return user;
};

export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
  const user = await getUserFromToken(req.cookies?.[AUTH_COOKIE]);
  if (!user) throw unauthorized();
  req.user = user;
  next();
};

/** The logged-in user. Only call in handlers mounted behind `requireAuth`. */
export const currentUser = (req: Request): UserDoc => {
  if (!req.user) throw unauthorized();
  return req.user;
};
