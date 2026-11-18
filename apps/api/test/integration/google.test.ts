import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

// Turn Google on for this file (config is read at import time).
vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-secret");

const { createApp } = await import("../../src/app.js");
const { User } = await import("../../src/models/user.js");
const { clearDb, startDb, stopDb } = await import("../helpers/db.js");
const { registerUser } = await import("../helpers/users.js");

const app = createApp();

beforeAll(startDb);
afterEach(async () => {
  vi.unstubAllGlobals();
  await clearDb();
});
afterAll(stopDb);

/** Makes Google's token endpoint return an ID token with these claims. */
const mockGoogle = (claims: Record<string, unknown>) => {
  const id_token = jwt.sign(
    { iss: "https://accounts.google.com", aud: "test-client-id", sub: "google-123", email_verified: true, ...claims },
    "irrelevant",
    { expiresIn: 300 },
  );
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id_token }), { status: 200 })));
};

/** Starts sign-in, then plays Google's redirect back to the callback. */
const completeSignIn = async (query = "") => {
  const agent = request.agent(app);
  const start = await agent.get(`/api/auth/google${query}`).expect(302);
  const state = new URL(start.headers.location!).searchParams.get("state");
  const done = await agent.get(`/api/auth/google/callback?code=abc&state=${state}`).expect(302);
  return { agent, location: done.headers.location! };
};

describe("Google sign-in", () => {
  it("is advertised when configured", async () => {
    await request(app).get("/api/auth/providers").expect(200, { google: true });
  });

  it("creates an account on first sign-in and signs the user in", async () => {
    mockGoogle({ email: "Grace@Example.com", name: "Grace Hopper", picture: "https://x/p.png" });
    const { agent, location } = await completeSignIn();
    expect(location).toMatch(/\/dashboard$/);

    const me = await agent.get("/api/me").expect(200);
    expect(me.body.user).toMatchObject({ email: "grace@example.com", fullName: "Grace Hopper", hasPassword: false });
    expect(me.body.user.googleId).toBeUndefined();
  });

  it("links to an existing password account with the same email", async () => {
    const existing = await registerUser(app);
    mockGoogle({ email: existing.email, name: "Whoever" });
    const { agent } = await completeSignIn();
    const me = await agent.get("/api/me").expect(200);
    expect(me.body.user._id).toBe(existing.id);
    expect(await User.countDocuments()).toBe(1);
  });

  it("returns to the invite page when sign-in started from an invite", async () => {
    mockGoogle({ email: "invitee@example.com", name: "Invitee" });
    const { location } = await completeSignIn("?invite=abcdefghijklmnopqrstuvwx");
    expect(location).toMatch(/\/invite\/abcdefghijklmnopqrstuvwx\?accept=1$/);
  });

  it("refuses unverified emails and tokens for another app", async () => {
    mockGoogle({ email: "x@example.com", email_verified: false });
    expect((await completeSignIn()).location).toMatch(/\/login\?error=google$/);

    mockGoogle({ email: "x@example.com", aud: "someone-elses-app" });
    expect((await completeSignIn()).location).toMatch(/\/login\?error=google$/);
    expect(await User.countDocuments()).toBe(0);
  });

  it("ignores off-site `next` redirects", async () => {
    mockGoogle({ email: "n@example.com", name: "Next Test" });
    const { location } = await completeSignIn("?next=//evil.example.com");
    expect(location).toMatch(/\/dashboard$/);
  });
});
