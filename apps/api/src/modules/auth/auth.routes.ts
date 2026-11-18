import { Router, type CookieOptions } from "express";
import { config } from "../../config.js";
import { AUTH_COOKIE } from "../../middleware/auth.js";
import { authLimiter } from "../../middleware/rateLimits.js";
import { validateBody } from "../../middleware/validate.js";
import { JWT_TTL_SECONDS } from "../../models/user.js";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "./auth.schemas.js";
import { authService } from "./auth.service.js";
import { googleEnabled, readOAuthState, safeNextPath, signInWithGoogle, startGoogleSignIn } from "./google.js";
import { logger } from "../../lib/logger.js";

export const authRouter = Router();

// Same-origin deployment => SameSite=Lax. `secure` is its own flag because a
// Secure cookie is silently dropped over plain HTTP.
const baseCookie: CookieOptions = { httpOnly: true, sameSite: "lax", secure: config.COOKIE_SECURE };
const sessionCookie: CookieOptions = { ...baseCookie, maxAge: JWT_TTL_SECONDS * 1000 };

authRouter.use(["/login", "/register", "/forgot-password", "/reset-password"], authLimiter);

authRouter.post("/login", validateBody(loginSchema), async (req, res) => {
  const user = await authService.login(req.body);
  res.cookie(AUTH_COOKIE, user.getJwtToken(), sessionCookie);
  res.json(user);
});

authRouter.post("/register", validateBody(registerSchema), async (req, res) => {
  const user = await authService.register(req.body);
  res.cookie(AUTH_COOKIE, user.getJwtToken(), sessionCookie);
  res.status(201).json({ message: "User registered successfully" });
});

authRouter.post("/forgot-password", validateBody(forgotPasswordSchema), async (req, res) => {
  await authService.requestPasswordReset(req.body.email);
  res.json({ message: "If an account exists for that email, a reset link is on its way." });
});

authRouter.post("/reset-password", validateBody(resetPasswordSchema), async (req, res) => {
  await authService.resetPassword(req.body);
  res.json({ message: "Password reset successfully" });
});

/* ---- Google ---- */

const OAUTH_COOKIE = "oauth_state";
const appUrl = (path: string) => `${config.APP_URL.replace(/\/$/, "")}${path}`;

authRouter.get("/providers", (_req, res) => {
  res.json({ google: googleEnabled() });
});

authRouter.get("/google", (req, res) => {
  if (!googleEnabled()) return res.redirect(appUrl("/login?error=google_disabled"));
  const invite = typeof req.query.invite === "string" && /^[\w-]{16,64}$/.test(req.query.invite) ? req.query.invite : undefined;
  const { url, cookie, maxAgeMs } = startGoogleSignIn({ invite, next: safeNextPath(req.query.next) });
  res.cookie(OAUTH_COOKIE, cookie, { ...baseCookie, maxAge: maxAgeMs });
  res.redirect(url);
});

authRouter.get("/google/callback", async (req, res) => {
  res.clearCookie(OAUTH_COOKIE, baseCookie);
  try {
    if (typeof req.query.code !== "string") throw new Error(String(req.query.error ?? "missing code"));
    const state = readOAuthState(req.cookies?.[OAUTH_COOKIE], req.query.state);
    const user = await signInWithGoogle(req.query.code);
    res.cookie(AUTH_COOKIE, user.getJwtToken(), sessionCookie);
    // The invite page accepts automatically once the user is signed in.
    res.redirect(appUrl(state.invite ? `/invite/${state.invite}?accept=1` : (state.next ?? "/dashboard")));
  } catch (err) {
    logger.warn({ err }, "Google sign-in failed");
    res.redirect(appUrl("/login?error=google"));
  }
});

authRouter.post("/logout", (_req, res) => {
  // Clear with the same attributes it was set with, or the browser keeps it.
  res.clearCookie(AUTH_COOKIE, baseCookie);
  res.json({ message: "Logged out successfully" });
});
