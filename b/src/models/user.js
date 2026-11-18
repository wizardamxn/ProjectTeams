import mongoose from "mongoose";
import validator from "validator";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

export const JWT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days; the auth cookie uses the same lifetime

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      minLength: 2,
      maxLength: 50,
    },
    email: {
      type: String,
      lowercase: true,
      required: true,
      unique: true,
      trim: true,
      validate(value) {
        if (!validator.isEmail(value)) {
          throw new Error("Invalid email address: " + value);
        }
      },
    },
    // Always a bcrypt hash. Strength is checked on the plain password in the
    // route, before hashing (validating the hash here checked nothing).
    password: {
      type: String,
      required: true,
    },
    teamCode: {
      type: String,
      required: true,
      minLength: 8,
      maxLength: 8,
      index: true,
    },
    passwordChangedAt: { type: Date },
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
  },
  {
    timestamps: true,
  },
);

userSchema.methods.getJwtToken = function () {
  return jwt.sign({ _id: this._id }, process.env.JWT_KEY, {
    expiresIn: JWT_TTL_SECONDS,
  });
};

userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;
