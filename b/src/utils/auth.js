import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/user.js";

// Shared by the HTTP middleware and the Socket.IO handshake so both
// authenticate exactly the same way.
export const getUserFromToken = async (token) => {
  if (!token) return null;

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_KEY);
  } catch {
    return null;
  }

  const user = await User.findById(decoded._id).select(
    "-password -resetTokenHash -resetTokenExpires",
  );
  if (!user) return null;

  // A password change/reset invalidates every token issued before it.
  if (user.passwordChangedAt && decoded.iat * 1000 < user.passwordChangedAt.getTime() - 1000) {
    return null;
  }

  return user;
};

// Returns the target user only if it is a real teammate of `user` (not themselves).
export const findTeammate = async (user, targetUserId) => {
  if (!targetUserId || !mongoose.isValidObjectId(targetUserId)) return null;
  if (String(targetUserId) === user._id.toString()) return null;
  return User.findOne({ _id: targetUserId, teamCode: user.teamCode }).select("_id fullName");
};
