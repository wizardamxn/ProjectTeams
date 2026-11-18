import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { io as connect, type Socket } from "socket.io-client";

const { files } = vi.hoisted(() => ({ files: new Map<string, Buffer>() }));
vi.mock("../../src/lib/storage.js", () => ({
  storage: {
    upload: vi.fn(async (path: string, data: Buffer) => void files.set(path, data)),
    download: vi.fn(async (path: string) => files.get(path)!),
    remove: vi.fn(async (path: string) => void files.delete(path)),
    signedUrls: vi.fn(async (paths: string[]) => paths.map((p) => `https://signed.example/${p}`)),
  },
}));

const { createApp } = await import("../../src/app.js");
const { initializeSocket } = await import("../../src/realtime/socket.js");
const { setRealtimeServer } = await import("../../src/realtime/emitter.js");
const { Chat } = await import("../../src/models/chat.js");
const { clearDb, startDb, stopDb } = await import("../helpers/db.js");
const { signUp, TEAM_A, TEAM_B } = await import("../helpers/users.js");
type TestUser = Awaited<ReturnType<typeof signUp>>;

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
  files.clear();
  await clearDb();
});
afterAll(async () => {
  setRealtimeServer(undefined);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await stopDb();
});

/* ---------- helpers ---------- */

const conversations = async (u: TestUser) =>
  (await u.agent.get("/api/conversations").expect(200)).body as {
    _id: string;
    type: string;
    name: string | null;
    isDefault: boolean;
    unreadCount: number;
    mentionCount: number;
    members: { _id: string }[];
  }[];

const general = async (u: TestUser) => (await conversations(u)).find((c) => c.isDefault)!;

const send = (u: TestUser, conversationId: string, body: Record<string, unknown>) =>
  u.agent.post(`/api/conversations/${conversationId}/messages`).send(body);

const dm = async (u: TestUser, ...others: TestUser[]) =>
  (await u.agent.post("/api/conversations/direct").send({ userIds: others.map((o) => o.id) }).expect(200)).body._id as string;

const cookieOf = async (u: TestUser) => {
  const res = await request(app).post("/api/auth/login").send({ email: u.email, password: u.password }).expect(200);
  return ([] as string[]).concat(res.headers["set-cookie"] ?? []).map((c) => c.split(";")[0]).join("; ");
};

const open = async (u: TestUser) => {
  const s = connect(url, { transports: ["websocket"], reconnection: false, extraHeaders: { cookie: await cookieOf(u) } });
  sockets.push(s);
  await new Promise<void>((resolve, reject) => {
    s.on("connect", () => resolve());
    s.on("connect_error", reject);
  });
  await new Promise((r) => setTimeout(r, 100)); // rooms joined after connect
  return s;
};

const next = <T>(s: Socket, event: string, ms = 3000) =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`no ${event} within ${ms}ms`)), ms);
    s.once(event, (data: T) => (clearTimeout(t), resolve(data)));
  });

const quiet = (s: Socket, event: string, ms = 300) =>
  new Promise<boolean>((resolve) => {
    let fired = false;
    s.on(event, () => (fired = true));
    setTimeout(() => resolve(!fired), ms);
  });

/* ---------- channels ---------- */

describe("channels", () => {
  it("every member is in #general, which can't be left", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    const ga = await general(alice);
    const gb = await general(bob);
    expect(ga.name).toBe("general");
    expect(ga._id).toBe(gb._id);
    await alice.agent.post(`/api/conversations/${ga._id}/leave`).expect(400);
  });

  it("both people opening their DM at once get the same conversation", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    const [a, b] = await Promise.all([dm(alice, bob), dm(bob, alice)]);
    expect(a).toBe(b);
  });

  it("creates, browses, joins and leaves public channels", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    const created = await alice.agent.post("/api/conversations/channels").send({ name: "Design Team" }).expect(201);
    expect(created.body.name).toBe("design-team");
    await alice.agent.post("/api/conversations/channels").send({ name: "design team" }).expect(409);

    const browse = (await bob.agent.get("/api/conversations/browse").expect(200)).body;
    expect(browse.map((c: { name: string }) => c.name)).toEqual(["design-team"]);

    await bob.agent.post(`/api/conversations/${created.body._id}/join`).expect(200);
    expect((await conversations(bob)).some((c) => c.name === "design-team")).toBe(true);
    await bob.agent.post(`/api/conversations/${created.body._id}/leave`).expect(200);
    await send(bob, created.body._id, { text: "hi" }).expect(404);
  });

  it("private channels are invisible and unjoinable to outsiders", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    const carol = await signUp(app, { team: TEAM_A });
    const secret = await alice.agent
      .post("/api/conversations/channels")
      .send({ name: "leadership", isPrivate: true, memberIds: [bob.id] })
      .expect(201);

    expect((await conversations(bob)).some((c) => c.name === "leadership")).toBe(true);
    expect((await carol.agent.get("/api/conversations/browse")).body).toHaveLength(0);
    await carol.agent.post(`/api/conversations/${secret.body._id}/join`).expect(404);
    await carol.agent.get(`/api/conversations/${secret.body._id}/messages`).expect(404);
  });

  it("only the creator or an admin renames; #general keeps its name", async () => {
    const owner = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    const carol = await signUp(app, { team: TEAM_A });
    const ch = (await bob.agent.post("/api/conversations/channels").send({ name: "random" }).expect(201)).body;
    await carol.agent.post(`/api/conversations/${ch._id}/join`).expect(200);

    await carol.agent.patch(`/api/conversations/${ch._id}`).send({ topic: "mine" }).expect(403);
    await bob.agent.patch(`/api/conversations/${ch._id}`).send({ name: "Off Topic" }).expect(200);
    const g = await general(owner);
    await owner.agent.patch(`/api/conversations/${g._id}`).send({ name: "everyone" }).expect(400);
    await owner.agent.patch(`/api/conversations/${g._id}`).send({ topic: "Hello all" }).expect(200);
  });

  it("can't add people from another workspace", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const mallory = await signUp(app, { team: TEAM_B });
    const ch = (await alice.agent.post("/api/conversations/channels").send({ name: "proj" }).expect(201)).body;
    const res = await alice.agent.post(`/api/conversations/${ch._id}/members`).send({ userIds: [mallory.id] }).expect(200);
    expect(res.body.added).toEqual([]);
  });
});

/* ---------- DMs and groups ---------- */

describe("direct messages", () => {
  it("one conversation per set of people", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    const carol = await signUp(app, { team: TEAM_A });
    const a = await dm(alice, bob);
    expect(await dm(bob, alice)).toBe(a);

    const group = await dm(alice, bob, carol);
    expect(group).not.toBe(a);
    expect((await conversations(carol)).find((c) => c._id === group)?.type).toBe("group");
  });

  it("other people can't read a DM", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    const carol = await signUp(app, { team: TEAM_A });
    const id = await dm(alice, bob);
    await send(alice, id, { text: "secret" }).expect(201);
    await carol.agent.get(`/api/conversations/${id}/messages`).expect(404);
    await send(carol, id, { text: "hi" }).expect(404);
  });

  it("can't DM someone outside the workspace", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const mallory = await signUp(app, { team: TEAM_B });
    await alice.agent.post("/api/conversations/direct").send({ userIds: [mallory.id] }).expect(400);
  });
});

/* ---------- messages ---------- */

describe("messages", () => {
  it("pages history newest-first, each page oldest-to-newest", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const g = await general(alice);
    for (let i = 1; i <= 7; i++) await send(alice, g._id, { text: `m${i}` }).expect(201);

    const p1 = (await alice.agent.get(`/api/conversations/${g._id}/messages?limit=3`).expect(200)).body;
    expect(p1.messages.map((m: { text: string }) => m.text)).toEqual(["m5", "m6", "m7"]);
    expect(p1.hasMore).toBe(true);
    const p2 = (await alice.agent.get(`/api/conversations/${g._id}/messages?limit=3&before=${p1.messages[0]._id}`)).body;
    expect(p2.messages.map((m: { text: string }) => m.text)).toEqual(["m2", "m3", "m4"]);
    const p3 = (await alice.agent.get(`/api/conversations/${g._id}/messages?limit=3&before=${p2.messages[0]._id}`)).body;
    expect(p3).toMatchObject({ hasMore: false });
    expect(p3.messages).toHaveLength(1);
  });

  it("sender comes from the session, and empty or huge messages are refused", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const g = await general(alice);
    const res = await send(alice, g._id, { text: "  hello  ", senderId: "64b0000000000000000000aa" }).expect(201);
    expect(res.body).toMatchObject({ text: "hello", sender: { _id: alice.id } });
    await send(alice, g._id, { text: "   " }).expect(400);
    await send(alice, g._id, { text: "x".repeat(4001) }).expect(400);
  });

  it("threads: replies stay out of the main timeline and count on the root", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    const g = await general(alice);
    const root = (await send(alice, g._id, { text: "Q4 plan?" }).expect(201)).body;
    await send(bob, g._id, { text: "Looks good", threadRootId: root._id }).expect(201);
    await send(alice, g._id, { text: "Thanks", threadRootId: root._id }).expect(201);

    const timeline = (await bob.agent.get(`/api/conversations/${g._id}/messages`)).body.messages;
    expect(timeline).toHaveLength(1);
    expect(timeline[0].replyCount).toBe(2);

    const thread = (await bob.agent.get(`/api/conversations/${g._id}/threads/${root._id}`).expect(200)).body;
    expect(thread.replies.map((r: { text: string }) => r.text)).toEqual(["Looks good", "Thanks"]);
  });

  it("only the sender edits; the sender or an admin deletes", async () => {
    const owner = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    const carol = await signUp(app, { team: TEAM_A });
    const g = await general(bob);
    const m = (await send(bob, g._id, { text: "typo" }).expect(201)).body;

    await carol.agent.patch(`/api/messages/${m._id}`).send({ text: "hacked" }).expect(403);
    const edited = await bob.agent.patch(`/api/messages/${m._id}`).send({ text: "fixed" }).expect(200);
    expect(edited.body.text).toBe("fixed");
    expect(edited.body.editedAt).toBeTruthy();

    await carol.agent.delete(`/api/messages/${m._id}`).expect(403);
    await owner.agent.delete(`/api/messages/${m._id}`).expect(200);
    const after = (await bob.agent.get(`/api/conversations/${g._id}/messages`)).body.messages[0];
    expect(after).toMatchObject({ deleted: true, text: "" });
  });

  it("attachments upload into the conversation and come back with signed URLs", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const g = await general(alice);
    const up = await alice.agent
      .post(`/api/conversations/${g._id}/attachments`)
      .attach("file", Buffer.from("png"), { filename: "shot.png", contentType: "image/png" })
      .expect(201);
    const msg = await send(alice, g._id, { attachments: [up.body] }).expect(201);
    expect(msg.body.attachments[0]).toMatchObject({ fileName: "shot.png", url: expect.stringContaining("https://signed.example/") });

    // Can't reference a file from somewhere else.
    await send(alice, g._id, { attachments: [{ ...up.body, storagePath: "other-ws/chat/x/file.png" }] }).expect(400);
    // Can't upload executables.
    await alice.agent
      .post(`/api/conversations/${g._id}/attachments`)
      .attach("file", Buffer.from("MZ"), { filename: "x.exe", contentType: "application/octet-stream" })
      .expect(415);
  });
});

/* ---------- unread, mentions, notifications ---------- */

describe("unread and notifications", () => {
  it("counts unread messages until the conversation is read", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    const id = await dm(alice, bob);
    await send(alice, id, { text: "one" }).expect(201);
    await send(alice, id, { text: "two" }).expect(201);

    expect((await conversations(bob)).find((c) => c._id === id)?.unreadCount).toBe(2);
    expect((await conversations(alice)).find((c) => c._id === id)?.unreadCount).toBe(0); // your own messages
    await bob.agent.post(`/api/conversations/${id}/read`).expect(200);
    expect((await conversations(bob)).find((c) => c._id === id)?.unreadCount).toBe(0);
  });

  it("@mentions notify only conversation members, never yourself", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    const carol = await signUp(app, { team: TEAM_A });
    const ch = (await alice.agent.post("/api/conversations/channels").send({ name: "small", memberIds: [bob.id] })).body;
    await send(alice, ch._id, { text: "@bob @carol @me", mentions: [bob.id, carol.id, alice.id] }).expect(201);

    const bobN = (await bob.agent.get("/api/notifications").expect(200)).body;
    expect(bobN.unread).toBe(1);
    expect(bobN.items[0]).toMatchObject({ type: "mention", conversationName: "#small", actor: { _id: alice.id } });
    expect((await carol.agent.get("/api/notifications")).body.unread).toBe(0);
    expect((await alice.agent.get("/api/notifications")).body.unread).toBe(0);
    expect((await conversations(bob)).find((c) => c._id === ch._id)?.mentionCount).toBe(1);

    await bob.agent.post("/api/notifications/read").send({}).expect(200);
    expect((await bob.agent.get("/api/notifications")).body.unread).toBe(0);
  });

  it("thread replies notify the root author and earlier repliers", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    const carol = await signUp(app, { team: TEAM_A });
    const g = await general(alice);
    const root = (await send(alice, g._id, { text: "root" })).body;
    await send(bob, g._id, { text: "r1", threadRootId: root._id }).expect(201);
    await send(carol, g._id, { text: "r2", threadRootId: root._id }).expect(201);

    const types = async (u: TestUser) => (await u.agent.get("/api/notifications")).body.items.map((n: { type: string }) => n.type);
    expect(await types(alice)).toEqual(["thread_reply", "thread_reply"]);
    expect(await types(bob)).toEqual(["thread_reply"]);
    expect(await types(carol)).toEqual([]);
  });
});

/* ---------- realtime ---------- */

describe("realtime", () => {
  it("delivers new messages to members only", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    const carol = await signUp(app, { team: TEAM_A });
    const id = await dm(alice, bob);
    const b = await open(bob);
    const c = await open(carol);

    const got = next<{ conversationId: string; message: { text: string } }>(b, "message:new");
    const carolQuiet = quiet(c, "message:new");
    await send(alice, id, { text: "just us" }).expect(201);
    expect((await got).message.text).toBe("just us");
    expect(await carolQuiet).toBe(true);
  });

  it("pushes edits and notifications", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    const g = await general(alice);
    const b = await open(bob);

    const note = next<{ type: string }>(b, "notification:new");
    const m = (await send(alice, g._id, { text: "hey @bob", mentions: [bob.id] })).body;
    expect((await note).type).toBe("mention");

    const upd = next<{ message: { text: string } }>(b, "message:updated");
    await alice.agent.patch(`/api/messages/${m._id}`).send({ text: "hey bob!" }).expect(200);
    expect((await upd).message.text).toBe("hey bob!");
  });

  it("relays typing to the other members only", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    const carol = await signUp(app, { team: TEAM_A });
    const id = await dm(alice, bob);
    const a = await open(alice);
    const b = await open(bob);
    const c = await open(carol);

    const typing = next<{ userId: string; conversationId: string }>(b, "typing");
    const carolQuiet = quiet(c, "typing");
    a.emit("typing", { conversationId: id });
    expect(await typing).toMatchObject({ userId: alice.id, conversationId: id });
    expect(await carolQuiet).toBe(true);

    // Carol can't fake typing into a conversation she isn't in.
    const bobQuiet = quiet(b, "typing");
    c.emit("typing", { conversationId: id });
    expect(await bobQuiet).toBe(true);
  });

  it("presence: online on connect, offline after the last tab closes", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    const a = await open(alice);

    const online = next<{ userId: string; online: boolean }>(a, "presence:update");
    const b1 = await open(bob);
    expect(await online).toEqual({ userId: bob.id, online: true });

    const b2 = await open(bob); // second tab: no event
    const list = await new Promise<string[]>((resolve) => a.emit("presence:list", resolve));
    expect(list.sort()).toEqual([alice.id, bob.id].sort());

    const stillOnline = quiet(a, "presence:update");
    b1.close();
    expect(await stillOnline).toBe(true);

    const offline = next<{ userId: string; online: boolean }>(a, "presence:update");
    b2.close();
    expect(await offline).toEqual({ userId: bob.id, online: false });
  });
});

/* ---------- migration ---------- */

describe("pre-Phase-4 chats", () => {
  it("are moved into DM conversations with their history and timestamps", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    const wsId = alice.workspaceId;
    const t1 = new Date("2026-01-01T10:00:00Z");
    await Chat.create({
      workspaceId: wsId,
      participants: [alice.id, bob.id],
      messages: [
        { senderId: alice.id, senderName: "A", text: "old one", createdAt: t1, updatedAt: t1 },
        { senderId: bob.id, senderName: "B", text: "old two", createdAt: new Date("2026-01-02T10:00:00Z") },
      ],
    });

    const list = await conversations(alice);
    const legacy = list.find((c) => c.type === "dm");
    expect(legacy).toBeDefined();
    const msgs = (await bob.agent.get(`/api/conversations/${legacy!._id}/messages`)).body.messages;
    expect(msgs.map((m: { text: string }) => m.text)).toEqual(["old one", "old two"]);
    expect(new Date(msgs[0].createdAt).toISOString()).toBe(t1.toISOString());

    // Running again doesn't duplicate.
    await conversations(bob);
    expect((await bob.agent.get(`/api/conversations/${legacy!._id}/messages`)).body.messages).toHaveLength(2);
    // And opening the DM normally lands in the same conversation.
    expect(await dm(bob, alice)).toBe(legacy!._id);
  });
});
