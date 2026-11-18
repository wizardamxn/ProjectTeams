import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { io as connect, type Socket } from "socket.io-client";
import { createApp } from "../../src/app.js";
import { initializeSocket } from "../../src/realtime/socket.js";
import { clearDb, startDb, stopDb } from "../helpers/db.js";
import { signUp, TEAM_A, TEAM_B } from "../helpers/users.js";

const app = createApp();
const server = http.createServer(app);
let url = "";
const sockets: Socket[] = [];

beforeAll(async () => {
  await startDb();
  initializeSocket(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  sockets.splice(0).forEach((s) => s.close());
  await clearDb();
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await stopDb();
});

type TestUser = Awaited<ReturnType<typeof signUp>>;

/** Logs in again to get a session cookie for the socket handshake. */
const cookieOf = async (user: TestUser) => {
  const res = await request(app).post("/api/auth/login").send({ email: user.email, password: user.password }).expect(200);
  const setCookie = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
  return setCookie.map((c) => c.split(";")[0]).join("; ");
};

const open = async (user: TestUser) => {
  const s = connect(url, { transports: ["websocket"], reconnection: false, extraHeaders: { cookie: await cookieOf(user) } });
  sockets.push(s);
  await new Promise<void>((resolve, reject) => {
    s.on("connect", () => resolve());
    s.on("connect_error", reject);
  });
  return s;
};

const nextEvent = <T>(s: Socket, event: string, ms = 3000) =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`no ${event} within ${ms}ms`)), ms);
    s.once(event, (data: T) => (clearTimeout(t), resolve(data)));
  });

const settle = () => new Promise((r) => setTimeout(r, 150));

describe("chat history route", () => {
  it("opens a chat with a teammate", async () => {
    const alice = await signUp(app, { teamCode: TEAM_A });
    const bob = await signUp(app, { teamCode: TEAM_A });
    const res = await alice.agent.get(`/api/chat/with/${bob.id}`).expect(200);
    expect(res.body.participants.sort()).toEqual([alice.id, bob.id].sort());
  });

  it("both teammates opening the chat at once get the same chat", async () => {
    const alice = await signUp(app, { teamCode: TEAM_A });
    const bob = await signUp(app, { teamCode: TEAM_A });
    const [a, b] = await Promise.all([
      alice.agent.get(`/api/chat/with/${bob.id}`).expect(200),
      bob.agent.get(`/api/chat/with/${alice.id}`).expect(200),
    ]);
    expect(a.body._id).toBe(b.body._id);
  });

  it("404s for someone outside the team, or yourself", async () => {
    const alice = await signUp(app, { teamCode: TEAM_A });
    const mallory = await signUp(app, { teamCode: TEAM_B });
    await alice.agent.get(`/api/chat/with/${mallory.id}`).expect(404);
    await alice.agent.get(`/api/chat/with/${alice.id}`).expect(404);
  });

  it("a third person cannot read two teammates' chat", async () => {
    const alice = await signUp(app, { teamCode: TEAM_A });
    const bob = await signUp(app, { teamCode: TEAM_A });
    const carol = await signUp(app, { teamCode: TEAM_A });
    await alice.agent.get(`/api/chat/with/${bob.id}`).expect(200);
    // The only chat Carol can open with Bob is her own.
    const res = await carol.agent.get(`/api/chat/with/${bob.id}`).expect(200);
    expect(res.body.participants).toContain(carol.id);
    expect(res.body.messages).toHaveLength(0);
  });
});

describe("realtime messaging", () => {
  it("delivers a message with the sender taken from the session", async () => {
    const alice = await signUp(app, { teamCode: TEAM_A, name: "Alice" });
    const bob = await signUp(app, { teamCode: TEAM_A, name: "Bob" });
    const a = await open(alice);
    const b = await open(bob);

    a.emit("joinChat", { targetUserId: bob.id });
    b.emit("joinChat", { targetUserId: alice.id });
    await settle();

    const received = nextEvent<{ message: { senderId: string; senderName: string; text: string } }>(b, "messageReceived");
    // Spoofed identity fields are ignored.
    a.emit("sendMessage", { targetUserId: bob.id, text: " hi bob ", userId: bob.id, senderName: "Bob" });
    const { message } = await received;
    expect(message.senderId).toBe(alice.id);
    expect(message.senderName).toBe(alice.profile.fullName);
    expect(message.text).toBe("hi bob");

    const history = await bob.agent.get(`/api/chat/with/${alice.id}`).expect(200);
    expect(history.body.messages).toHaveLength(1);
  });

  it("refuses to open or message a chat outside the team", async () => {
    const alice = await signUp(app, { teamCode: TEAM_A });
    const mallory = await signUp(app, { teamCode: TEAM_B });
    const m = await open(mallory);

    const err1 = nextEvent<string>(m, "error");
    m.emit("joinChat", { targetUserId: alice.id });
    expect(await err1).toMatch(/not found/i);

    const err2 = nextEvent<string>(m, "error");
    m.emit("sendMessage", { targetUserId: alice.id, text: "hello" });
    expect(await err2).toMatch(/not found/i);
  });

  it("switching chats stops messages from the previous one", async () => {
    const alice = await signUp(app, { teamCode: TEAM_A });
    const bob = await signUp(app, { teamCode: TEAM_A });
    const carol = await signUp(app, { teamCode: TEAM_A });
    const a = await open(alice);
    const b = await open(bob);

    a.emit("joinChat", { targetUserId: bob.id });
    await settle();
    a.emit("joinChat", { targetUserId: carol.id }); // Alice moves to Carol's chat
    b.emit("joinChat", { targetUserId: alice.id });
    await settle();

    let leaked = false;
    a.on("messageReceived", () => (leaked = true));
    b.emit("sendMessage", { targetUserId: alice.id, text: "are you there?" });
    await settle();
    expect(leaked).toBe(false);
  });

  it("rejects empty and oversized messages", async () => {
    const alice = await signUp(app, { teamCode: TEAM_A });
    const bob = await signUp(app, { teamCode: TEAM_A });
    const a = await open(alice);

    const e1 = nextEvent<string>(a, "error");
    a.emit("sendMessage", { targetUserId: bob.id, text: "   " });
    expect(await e1).toMatch(/empty/i);

    const e2 = nextEvent<string>(a, "error");
    a.emit("sendMessage", { targetUserId: bob.id, text: "x".repeat(4001) });
    expect(await e2).toMatch(/too long/i);
  });
});
