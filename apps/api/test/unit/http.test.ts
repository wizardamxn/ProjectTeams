import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { io as connect } from "socket.io-client";
import { createApp } from "../../src/app.js";
import { initializeSocket } from "../../src/realtime/socket.js";

// These run without a database: they prove the gates reject requests before
// any data is touched.

const app = createApp();

describe("unauthenticated access is rejected", () => {
  it.each([
    ["get", "/api/profile/profile"],
    ["get", "/api/profile/teammembers"],
    ["get", "/api/doc/teamdocs"],
    ["get", "/api/doc/doc/64b0000000000000000000aa"],
    ["put", "/api/doc/edit/64b0000000000000000000aa"],
    ["delete", "/api/doc/teamdocs/64b0000000000000000000aa"],
    ["get", "/api/chat/with/64b0000000000000000000aa"],
    ["post", "/api/ai/summarize"],
    ["post", "/api/ai/generate-tags"],
    ["post", "/api/ai/improve-writing"],
    ["post", "/api/ai/ask-docs"],
    ["get", "/api/upload/documents"],
    ["post", "/api/upload/document"],
  ] as const)("%s %s -> 401", async (method, path) => {
    const res = await request(app)[method](path).send({});
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ message: expect.any(String) });
  });

  it("rejects a token signed with the wrong key", async () => {
    const forged = jwt.sign({ _id: "64b0000000000000000000aa" }, "not-the-key");
    await request(app).get("/api/profile/profile").set("Cookie", `token=${forged}`).expect(401);
  });
});

describe("input validation happens before any work", () => {
  it("register rejects a weak password", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ fullName: "Al", email: "al@example.com", password: "short", teamCode: "12345678" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/8 characters/);
  });

  it("register rejects a malformed team code", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ fullName: "Al", email: "al@example.com", password: "password123", teamCode: "abc" });
    expect(res.status).toBe(400);
  });

  it("reset-password rejects a malformed token", async () => {
    await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "nope", newPassword: "password123" })
      .expect(400);
  });

  it("malformed JSON is a 400, not a 500", async () => {
    await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{bad json")
      .expect(400);
  });
});

describe("basics", () => {
  it("health check", async () => {
    await request(app).get("/api/health").expect(200, { ok: true });
  });
  it("unknown routes are JSON 404s", async () => {
    const res = await request(app).get("/api/nope").expect(404);
    expect(res.body.message).toBe("Not found");
  });
});

describe("socket handshake", () => {
  const server = http.createServer(app);
  let url = "";

  beforeAll(async () => {
    initializeSocket(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const tryConnect = (cookie?: string) =>
    new Promise<string>((resolve) => {
      const s = connect(url, {
        transports: ["websocket"],
        reconnection: false,
        extraHeaders: cookie ? { cookie } : {},
      });
      s.on("connect", () => (s.close(), resolve("connected")));
      s.on("connect_error", (e) => (s.close(), resolve(e.message)));
    });

  it("rejects a socket without a session cookie", async () => {
    expect(await tryConnect()).toBe("unauthorized");
  });

  it("rejects a forged session cookie", async () => {
    const forged = jwt.sign({ _id: "64b0000000000000000000aa" }, "not-the-key");
    expect(await tryConnect(`token=${forged}`)).toBe("unauthorized");
  });
});
