import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

// Capture outgoing email so the test can read the reset link.
const { sent } = vi.hoisted(() => ({ sent: [] as { to: string; text: string }[] }));
vi.mock("../../src/lib/mailer.js", () => ({
  sendMail: vi.fn(async (mail: { to: string; text: string }) => void sent.push(mail)),
}));

const { createApp } = await import("../../src/app.js");
const { clearDb, startDb, stopDb } = await import("../helpers/db.js");
const { signUp } = await import("../helpers/users.js");

const app = createApp();

beforeAll(startDb);
afterEach(async () => {
  sent.length = 0;
  await clearDb();
});
afterAll(stopDb);

describe("register + login", () => {
  it("registers, sets an httpOnly session cookie, and never returns the hash", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ fullName: "Ada Lovelace", email: "ADA@Example.com", password: "password123" })
      .expect(201);
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toMatch(/token=/);
    expect(cookie).toMatch(/HttpOnly/i);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: "password123" })
      .expect(200);
    expect(login.body.email).toBe("ada@example.com");
    expect(login.body.password).toBeUndefined();
  });

  it("rejects a wrong password with a generic message", async () => {
    const { email } = await signUp(app);
    const res = await request(app).post("/api/auth/login").send({ email, password: "wrongpass1" }).expect(401);
    expect(res.body.message).toBe("Invalid email or password");
  });

  it("rejects a duplicate email", async () => {
    const { email } = await signUp(app);
    await request(app)
      .post("/api/auth/register")
      .send({ fullName: "Copy Cat", email, password: "password123" })
      .expect(409);
  });

  it("profile never exposes the password hash", async () => {
    const { profile } = await signUp(app);
    expect(profile.password).toBeUndefined();
    expect(profile.resetTokenHash).toBeUndefined();
  });
});

describe("password reset", () => {
  it("answers the same for unknown emails and sends nothing", async () => {
    const res = await request(app).post("/api/auth/forgot-password").send({ email: "ghost@example.com" }).expect(200);
    expect(res.body.message).toMatch(/If an account exists/);
    expect(sent).toHaveLength(0);
  });

  it("resets with the emailed token, once, and signs out old sessions", async () => {
    const { agent, email } = await signUp(app);
    await request(app).post("/api/auth/forgot-password").send({ email }).expect(200);
    expect(sent).toHaveLength(1);
    const token = /token=([a-f0-9]{64})/.exec(sent[0]!.text)?.[1];
    expect(token).toBeDefined();

    // Make sure the reset lands in a later second than the original login.
    await new Promise((r) => setTimeout(r, 1100));
    await request(app).post("/api/auth/reset-password").send({ token, newPassword: "newpassword9" }).expect(200);

    // Old session is revoked.
    await agent.get("/api/profile/profile").expect(401);
    // Token is single-use.
    await request(app).post("/api/auth/reset-password").send({ token, newPassword: "another123" }).expect(400);
    // New password works, old one doesn't.
    await request(app).post("/api/auth/login").send({ email, password: "newpassword9" }).expect(200);
    await request(app).post("/api/auth/login").send({ email, password: "password123" }).expect(401);
  });

  it("the old team-code reset no longer works", async () => {
    const { email } = await signUp(app);
    await request(app)
      .post("/api/auth/reset-password")
      .send({ email, teamCode: "11111111", newPassword: "hijacked123" })
      .expect(400);
  });
});

describe("logout", () => {
  it("clears the session cookie", async () => {
    const { agent } = await signUp(app);
    await agent.post("/api/auth/logout").expect(200);
    await agent.get("/api/profile/profile").expect(401);
  });
});
