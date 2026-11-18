import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { config } from "../../config.js";
import { badRequest } from "../../lib/errors.js";
import { User, type UserDoc } from "../../models/user.js";

// Google sign-in with the OAuth 2.0 authorization-code flow, done server-side
// (no Google SDK). The ID token comes straight from Google's token endpoint
// over TLS with our client secret, so per OpenID Connect its claims can be
// trusted without re-verifying the signature; we still check iss/aud/expiry.

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const STATE_TTL_SECONDS = 10 * 60;

export const googleEnabled = () => Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET);

const redirectUri = () =>
  config.GOOGLE_REDIRECT_URI ?? `${config.APP_URL.replace(/\/$/, "")}/api/auth/google/callback`;

/** Where to send the browser after sign-in. Only same-site paths, never a full URL. */
export const safeNextPath = (next: unknown) =>
  typeof next === "string" && /^\/(?!\/)[\w\-./?=&%]*$/.test(next) ? next : undefined;

export interface OAuthState {
  state: string;
  invite?: string;
  next?: string;
}

/** Builds the Google consent URL and a signed cookie value that remembers the request. */
export const startGoogleSignIn = (opts: { invite?: string; next?: string }) => {
  const state = crypto.randomBytes(16).toString("hex");
  const cookie = jwt.sign({ state, invite: opts.invite, next: opts.next } satisfies OAuthState, config.JWT_KEY, {
    expiresIn: STATE_TTL_SECONDS,
  });
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: config.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();
  return { url: url.toString(), cookie, maxAgeMs: STATE_TTL_SECONDS * 1000 };
};

export const readOAuthState = (cookie: string | undefined, returnedState: unknown): OAuthState => {
  try {
    const decoded = jwt.verify(cookie ?? "", config.JWT_KEY) as OAuthState;
    if (typeof returnedState === "string" && decoded.state === returnedState) return decoded;
  } catch {
    /* fall through */
  }
  throw badRequest("Sign-in expired or was tampered with. Please try again.", "bad_oauth_state");
};

interface GoogleIdToken {
  iss: string;
  aud: string;
  exp: number;
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

const exchangeCode = async (code: string): Promise<GoogleIdToken> => {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.GOOGLE_CLIENT_ID!,
      client_secret: config.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw badRequest("Google sign-in failed. Please try again.", "google_exchange_failed");

  const body = (await res.json()) as { id_token?: string };
  const claims = body.id_token ? (jwt.decode(body.id_token) as GoogleIdToken | null) : null;
  const validIssuer = claims && ["accounts.google.com", "https://accounts.google.com"].includes(claims.iss);
  if (!claims || !validIssuer || claims.aud !== config.GOOGLE_CLIENT_ID || claims.exp * 1000 < Date.now()) {
    throw badRequest("Google sign-in failed. Please try again.", "google_bad_token");
  }
  if (!claims.email || !claims.email_verified) {
    throw badRequest("Your Google account needs a verified email address.", "google_unverified");
  }
  return claims;
};

/**
 * Finds or creates the user for a Google account. An existing password account
 * with the same (Google-verified) email is linked, not duplicated.
 */
export const signInWithGoogle = async (code: string): Promise<UserDoc> => {
  const claims = await exchangeCode(code);
  const email = claims.email!.toLowerCase();

  const byGoogle = await User.findOne({ googleId: claims.sub });
  if (byGoogle) return byGoogle;

  const byEmail = await User.findOne({ email });
  if (byEmail) {
    byEmail.googleId = claims.sub;
    byEmail.avatarUrl ??= claims.picture;
    return byEmail.save();
  }

  const name = (claims.name ?? "").trim();
  return User.create({
    fullName: (name.length >= 2 ? name : email.split("@")[0]!).slice(0, 50).padEnd(2, "_"),
    email,
    googleId: claims.sub,
    avatarUrl: claims.picture,
  });
};
