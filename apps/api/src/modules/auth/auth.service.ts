import bcrypt from "bcrypt";
import crypto from "node:crypto";
import validator from "validator";
import { config } from "../../config.js";
import { badRequest, conflict, unauthorized } from "../../lib/errors.js";
import { sendMail } from "../../lib/mailer.js";
import { User, type UserDoc } from "../../models/user.js";
import type { LoginInput, RegisterInput, ResetPasswordInput } from "./auth.schemas.js";

const BCRYPT_ROUNDS = 10;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export const authService = {
  async login({ email, password }: LoginInput): Promise<UserDoc> {
    const user = await User.findOne({ email });
    if (!user || !(await user.isPasswordCorrect(password))) {
      throw unauthorized("Invalid email or password");
    }
    return user;
  },

  async register(input: RegisterInput): Promise<UserDoc> {
    if (await User.exists({ email: input.email })) throw conflict("Email already exists");
    return User.create({
      ...input,
      password: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
    });
  },

  /** Emails a one-time link. Silently does nothing for unknown emails. */
  async requestPasswordReset(rawEmail: string) {
    const email = rawEmail.trim().toLowerCase();
    if (!validator.isEmail(email)) return;

    const user = await User.findOne({ email });
    if (!user) return;

    const token = crypto.randomBytes(32).toString("hex");
    user.resetTokenHash = hashToken(token);
    user.resetTokenExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save();

    const link = `${config.APP_URL.replace(/\/$/, "")}/reset-password?token=${token}`;
    await sendMail({
      to: user.email,
      subject: "Reset your Project Teams password",
      text: `Hi ${user.fullName},\n\nReset your password here (valid for 30 minutes):\n${link}\n\nIf you didn't ask for this, ignore this email.`,
      html: `<p>Hi ${validator.escape(user.fullName)},</p><p><a href="${link}">Reset your password</a> (valid for 30 minutes).</p><p>If you didn't ask for this, ignore this email.</p>`,
    });
  },

  async resetPassword({ token, newPassword }: ResetPasswordInput) {
    const user = await User.findOne({
      resetTokenHash: hashToken(token),
      resetTokenExpires: { $gt: new Date() },
    });
    if (!user) throw badRequest("This reset link is invalid or has expired", "invalid_token");

    user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    user.passwordChangedAt = new Date(); // signs out every existing session
    user.resetTokenHash = undefined;
    user.resetTokenExpires = undefined;
    await user.save();
  },
};
