import mongoose, { Schema, type HydratedDocument, type Model, type Types } from "mongoose";
import validator from "validator";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { config } from "../config.js";

export const JWT_TTL_SECONDS = 7 * 24 * 60 * 60; // the auth cookie uses the same lifetime

export interface IUser {
  _id: Types.ObjectId;
  fullName: string;
  email: string;
  /** bcrypt hash; absent for accounts that only sign in with Google. */
  password?: string;
  /** Legacy shared team code (pre-workspaces). Migrated on first use; unused after that. */
  teamCode?: string;
  activeWorkspaceId?: Types.ObjectId;
  googleId?: string;
  avatarUrl?: string;
  passwordChangedAt?: Date;
  resetTokenHash?: string;
  resetTokenExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface IUserMethods {
  getJwtToken(): string;
  isPasswordCorrect(password: string): Promise<boolean>;
}

export type UserDoc = HydratedDocument<IUser, IUserMethods>;
type UserModel = Model<IUser, object, IUserMethods>;

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    fullName: { type: String, required: true, trim: true, minLength: 2, maxLength: 50 },
    email: {
      type: String,
      lowercase: true,
      required: true,
      unique: true,
      trim: true,
      validate: { validator: (v: string) => validator.isEmail(v), message: "Invalid email address" },
    },
    password: { type: String },
    teamCode: { type: String, minLength: 8, maxLength: 8, index: true },
    activeWorkspaceId: { type: Schema.Types.ObjectId, ref: "Workspace" },
    googleId: { type: String, unique: true, sparse: true },
    avatarUrl: { type: String },
    passwordChangedAt: { type: Date },
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
  },
  { timestamps: true },
);

userSchema.methods.getJwtToken = function () {
  return jwt.sign({ _id: this._id.toString() }, config.JWT_KEY, { expiresIn: JWT_TTL_SECONDS });
};

userSchema.methods.isPasswordCorrect = async function (password: string) {
  if (!this.password) return false; // Google-only account
  return bcrypt.compare(password, this.password);
};

// Never serialise secrets, whatever the caller selected.
userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const out = ret as unknown as Record<string, unknown>;
    out.hasPassword = Boolean(out.password);
    delete out.password;
    delete out.resetTokenHash;
    delete out.resetTokenExpires;
    delete out.googleId;
    delete out.__v;
    return out;
  },
});

export const User = mongoose.model<IUser, UserModel>("User", userSchema);
