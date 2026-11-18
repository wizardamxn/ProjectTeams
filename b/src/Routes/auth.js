import express from "express";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import validator from "validator";
import User, { JWT_TTL_SECONDS } from "../models/user.js";
import { authLimiter } from "../middlewares/rateLimits.js";
import { sendMail } from "../utils/mailer.js";

const authRouter = express.Router();

// Shared cookie options so login, register, and logout never drift apart.
// Same-origin deployment => SameSite=Lax (also works cross-port in local dev).
// `secure` is decoupled from NODE_ENV: a Secure cookie is silently dropped over
// plain HTTP, so flip COOKIE_SECURE=true only once HTTPS is terminating in front.
const baseCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.COOKIE_SECURE === "true",
};
const cookieOptions = { ...baseCookieOptions, maxAge: JWT_TTL_SECONDS * 1000 };

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

// 8+ chars with at least one letter and one number. Kept simple on purpose;
// length matters more than symbol rules.
const PASSWORD_RULE = "Password must be at least 8 characters and include a letter and a number";
const isPasswordOk = (password) =>
  typeof password === "string" &&
  password.length >= 8 &&
  password.length <= 128 &&
  /[a-zA-Z]/.test(password) &&
  /\d/.test(password);

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const toSafeUser = (user) => {
  const safe = user.toObject();
  delete safe.password;
  delete safe.resetTokenHash;
  delete safe.resetTokenExpires;
  return safe;
};

authRouter.use(["/login", "/register", "/forgot-password", "/reset-password"], authLimiter);

/* ================= LOGIN ================= */
authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || !(await user.isPasswordCorrect(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.cookie("token", user.getJwtToken(), cookieOptions);
    res.status(200).json(toSafeUser(user));
  } catch (err) {
    next(err);
  }
});

/* ================= REGISTER ================= */
authRouter.post("/register", async (req, res, next) => {
  try {
    const { fullName, email, password, teamCode } = req.body;

    if (!fullName || !email || !password || !teamCode) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (typeof email !== "string" || !validator.isEmail(email.trim())) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }
    if (!isPasswordOk(password)) {
      return res.status(400).json({ message: PASSWORD_RULE });
    }
    if (typeof teamCode !== "string" || !/^\d{8}$/.test(teamCode)) {
      return res.status(400).json({ message: "Team code must be 8 digits" });
    }

    const user = await User.create({
      fullName: String(fullName).trim(),
      email: email.trim().toLowerCase(),
      password: await bcrypt.hash(password, 10),
      teamCode,
    });

    res.cookie("token", user.getJwtToken(), cookieOptions);
    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "Email already exists" });
    }
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: "Please check your details and try again" });
    }
    next(err);
  }
});

/* ================= FORGOT PASSWORD ================= */
// Always answers the same way so it can't be used to find out which emails exist.
authRouter.post("/forgot-password", async (req, res, next) => {
  const genericReply = {
    message: "If an account exists for that email, a reset link is on its way.",
  };

  try {
    const { email } = req.body;
    if (typeof email !== "string" || !validator.isEmail(email.trim())) {
      return res.status(200).json(genericReply);
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) return res.status(200).json(genericReply);

    const token = crypto.randomBytes(32).toString("hex");
    user.resetTokenHash = hashToken(token);
    user.resetTokenExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save();

    const appUrl = (process.env.APP_URL || "http://localhost:8080").replace(/\/$/, "");
    const link = `${appUrl}/reset-password?token=${token}`;

    await sendMail({
      to: user.email,
      subject: "Reset your Project Teams password",
      text: `Hi ${user.fullName},\n\nReset your password here (valid for 30 minutes):\n${link}\n\nIf you didn't ask for this, ignore this email.`,
      html: `<p>Hi ${validator.escape(user.fullName)},</p><p><a href="${link}">Reset your password</a> (valid for 30 minutes).</p><p>If you didn't ask for this, ignore this email.</p>`,
    });

    res.status(200).json(genericReply);
  } catch (err) {
    next(err);
  }
});

/* ================= RESET PASSWORD ================= */
authRouter.post("/reset-password", async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
      return res.status(400).json({ message: "This reset link is invalid or has expired" });
    }
    if (!isPasswordOk(newPassword)) {
      return res.status(400).json({ message: PASSWORD_RULE });
    }

    const user = await User.findOne({
      resetTokenHash: hashToken(token),
      resetTokenExpires: { $gt: new Date() },
    });
    if (!user) {
      return res.status(400).json({ message: "This reset link is invalid or has expired" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordChangedAt = new Date(); // signs out every existing session
    user.resetTokenHash = undefined;
    user.resetTokenExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (err) {
    next(err);
  }
});

/* ================= LOGOUT ================= */
authRouter.post("/logout", (req, res) => {
  // Clear with attributes matching how it was set, or the browser keeps it.
  res.clearCookie("token", baseCookieOptions);
  res.json({ message: "Logged out successfully" });
});

export default authRouter;
