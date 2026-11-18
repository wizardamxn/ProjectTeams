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
  /** Always a bcrypt hash; strength is checked on the plain text before hashing. */
  password: string;
  teamCode: string;
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
    password: { type: String, required: true },
    teamCode: { type: String, required: true, minLength: 8, maxLength: 8, index: true },
    passwordChangedAt: { type: Date },
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
  },
  { timestamps: true },
);

userSchema.methods.getJwtToken = function () {
  return jwt.sign({ _id: this._id.toString() }, config.JWT_KEY, { expiresIn: JWT_TTL_SECONDS });
};

userSchema.methods.isPasswordCorrect = function (password: string) {
  return bcrypt.compare(password, this.password);
};

// Never serialise secrets, whatever the caller selected.
userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const out = ret as unknown as Record<string, unknown>;
    delete out.password;
    delete out.resetTokenHash;
    delete out.resetTokenExpires;
    delete out.__v;
    return out;
  },
});

export const User = mongoose.model<IUser, UserModel>("User", userSchema);
