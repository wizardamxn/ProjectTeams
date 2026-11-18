import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import * as Y from "yjs";
import { io as connect, type Socket } from "socket.io-client";

const { posts } = vi.hoisted(() => ({ posts: [] as { url: string; body: string; headers: Record<string, string> }[] }));
vi.mock("../../src/queues/ragQueue.js", () => ({
  enqueueIngest: vi.fn(async () => null),
  enqueueDocIndex: vi.fn(async () => null),
  enqueueChatIndex: vi.fn(async () => null),
}));
// Webhooks: capture what would be sent instead of going on the network.
vi.mock("../../src/modules/webhooks/safeFetch.js", async (orig) => {
  const real = await orig<typeof import("../../src/modules/webhooks/safeFetch.js")>();
  return {
    ...real,
    safePost: vi.fn(async (url: string, body: string, headers: Record<string, string>) => {
      posts.push({ url, body, headers });
      return url.includes("fail") ? { ok: false, statusCode: 500, error: "HTTP 500", durationMs: 1 } : { ok: true, statusCode: 200, durationMs: 1 };
    }),
  };
});

const { createApp } = await import("../../src/app.js");
const { initializeSocket } = await import("../../src/realtime/socket.js");
const { setRealtimeServer } = await import("../../src/realtime/emitter.js");
const { jsonToState, replaceUpdate, stateToJson } = await import("../../src/modules/collab/collab.service.js");
const { Notification } = await import("../../src/models/notification.js");
const { Webhook } = await import("../../src/models/webhook.js");
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
  posts.length = 0;
  await clearDb();
});
afterAll(async () => {
  setRealtimeServer(undefined);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await stopDb();
});

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
  return s;
};

const next = <T>(s: Socket, event: string, ms = 4000) =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`no ${event} within ${ms}ms`)), ms);
    s.once(event, (data: T) => (clearTimeout(t), resolve(data)));
  });

type JoinAck = { ok: true; state: ArrayBuffer } | { ok: false; error: string };
const join = (s: Socket, docId: string) =>
  new Promise<JoinAck>((resolve) => s.emit("doc:join", { docId }, (res: JoinAck) => resolve(res)));

const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const body = (...texts: string[]) => ({ type: "doc", content: texts.map(p) });

const newDoc = async (u: TestUser, ...texts: string[]) =>
  (await u.agent.post("/api/doc/create").send({ title: "Live", contentJson: body(...texts) }).expect(201)).body.document._id as string;

describe("live co-editing", () => {
  it("joining returns the doc; edits reach the others and are saved", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    const docId = await newDoc(alice, "hello");

    const [sa, sb] = [await open(alice), await open(bob)];
    const [ja, jb] = [await join(sa, docId), await join(sb, docId)];
    if (!ja.ok || !jb.ok) throw new Error("join failed");
    const state = new Uint8Array(ja.state);
    expect(stateToJson(state)).toEqual(body("hello"));

    // Alice edits; Bob's copy follows.
    const update = replaceUpdate(state, body("hello world"));
    const got = next<{ docId: string; update: ArrayBuffer }>(sb, "doc:update");
    sa.emit("doc:update", { docId, update });
    const received = await got;
    const bobDoc = new Y.Doc();
    Y.applyUpdate(bobDoc, new Uint8Array(jb.state));
    Y.applyUpdate(bobDoc, new Uint8Array(received.update));
    expect(stateToJson(Y.encodeStateAsUpdate(bobDoc))).toEqual(body("hello world"));

    // A moment later the plain fields (search, AI, lists) catch up.
    await vi.waitFor(
      async () => {
        const doc = (await bob.agent.get(`/api/doc/doc/${docId}`).expect(200)).body;
        expect(doc.content).toBe("hello world");
        expect(doc.lastEditedBy).toBe(alice.id);
      },
      { timeout: 6000, interval: 250 },
    );

    // A fresh join sees the edit.
    const again = await join(await open(bob), docId);
    expect(again.ok && stateToJson(new Uint8Array(again.state))).toEqual(body("hello world"));
  });

  it("outsiders can't join, and updates from sockets that didn't join are ignored", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const eve = await signUp(app, { team: TEAM_B });
    const docId = await newDoc(alice, "secret");
    const se = await open(eve);
    expect(await join(se, docId)).toEqual({ ok: false, error: "not_found" });

    se.emit("doc:update", { docId, update: replaceUpdate(jsonToState(body("secret")), body("hacked")) });
    await new Promise((r) => setTimeout(r, 2500));
    const doc = (await alice.agent.get(`/api/doc/doc/${docId}`).expect(200)).body;
    expect(doc.content).toBe("secret");
  });

  it("garbage updates are rejected", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const docId = await newDoc(alice, "x");
    const s = await open(alice);
    await join(s, docId);
    const err = next<{ error: string }>(s, "doc:error");
    s.emit("doc:update", { docId, update: new Uint8Array([9, 9, 9, 9]) });
    expect((await err).error).toBe("rejected");
  });

  it("restoring a version (or a REST save) updates everyone who has it open", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    const docId = await newDoc(alice, "v1");
    await alice.agent.put(`/api/doc/edit/${docId}`).send({ contentJson: body("v2") }).expect(200);

    const sb = await open(bob);
    const jb = await join(sb, docId);
    if (!jb.ok) throw new Error("join failed");

    const versions = (await alice.agent.get(`/api/doc/doc/${docId}/versions`).expect(200)).body;
    const v1 = versions.find((v: { preview: string }) => v.preview === "v1");
    const got = next<{ update: ArrayBuffer }>(sb, "doc:update");
    await alice.agent.post(`/api/doc/doc/${docId}/versions/${v1._id}/restore`).expect(200);

    const bobDoc = new Y.Doc();
    Y.applyUpdate(bobDoc, new Uint8Array(jb.state));
    Y.applyUpdate(bobDoc, new Uint8Array((await got).update));
    expect(stateToJson(Y.encodeStateAsUpdate(bobDoc))).toEqual(body("v1"));
    expect((await alice.agent.get(`/api/doc/doc/${docId}`).expect(200)).body.content).toBe("v1");

    // A REST save with content on a live doc goes through the same path.
    const got2 = next(sb, "doc:update");
    await alice.agent.put(`/api/doc/edit/${docId}`).send({ contentJson: body("v3"), title: "Renamed" }).expect(200);
    await got2;
    const doc = (await alice.agent.get(`/api/doc/doc/${docId}`).expect(200)).body;
    expect(doc).toMatchObject({ content: "v3", title: "Renamed" });
  });
});

describe("comments", () => {
  it("threads, replies, resolve, edit and delete, with notifications", async () => {
    const alice = await signUp(app, { team: TEAM_A }); // doc author
    const bob = await signUp(app, { team: TEAM_A });
    const docId = await newDoc(alice, "text");

    const thread = await bob.agent.post(`/api/doc/doc/${docId}/comments`).send({ text: "Is this right?", quote: "text" }).expect(201);
    await vi.waitFor(async () => expect(await Notification.countDocuments({ userId: alice.id, type: "doc_comment" })).toBe(1));

    await alice.agent.post(`/api/doc/doc/${docId}/comments`).send({ text: "Yes", parentId: thread.body._id }).expect(201);
    await vi.waitFor(async () => expect(await Notification.countDocuments({ userId: bob.id, type: "doc_comment" })).toBe(1));

    await alice.agent.post(`/api/doc/doc/${docId}/comments/${thread.body._id}/resolve`).send({ resolved: true }).expect(200);
    let list = (await bob.agent.get(`/api/doc/doc/${docId}/comments`).expect(200)).body;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ text: "Is this right?", quote: "text", resolvedBy: { _id: alice.id } });
    expect(list[0].replies.map((r: { text: string }) => r.text)).toEqual(["Yes"]);

    // Replying reopens it.
    await bob.agent.post(`/api/doc/doc/${docId}/comments`).send({ text: "One more thing", parentId: thread.body._id }).expect(201);
    list = (await bob.agent.get(`/api/doc/doc/${docId}/comments`).expect(200)).body;
    expect(list[0].resolvedAt).toBeNull();

    // Only the author edits; replies can't be replied to.
    await alice.agent.patch(`/api/doc/doc/${docId}/comments/${thread.body._id}`).send({ text: "hijack" }).expect(403);
    await bob.agent.patch(`/api/doc/doc/${docId}/comments/${thread.body._id}`).send({ text: "Is this right??" }).expect(200);
    const reply = list[0].replies[0]._id;
    await bob.agent.post(`/api/doc/doc/${docId}/comments`).send({ text: "x", parentId: reply }).expect(400);

    // Members delete only their own (admins any); deleting the first comment removes the thread.
    const carol = await signUp(app, { team: TEAM_A });
    await carol.agent.delete(`/api/doc/doc/${docId}/comments/${thread.body._id}`).expect(403);
    const del = await bob.agent.delete(`/api/doc/doc/${docId}/comments/${thread.body._id}`).expect(200);
    expect(del.body).toEqual({ threadDeleted: true });
    expect((await bob.agent.get(`/api/doc/doc/${docId}/comments`).expect(200)).body).toEqual([]);
  });

  it("are per workspace and go with the doc", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const eve = await signUp(app, { team: TEAM_B });
    const docId = await newDoc(alice, "x");
    await alice.agent.post(`/api/doc/doc/${docId}/comments`).send({ text: "hi" }).expect(201);
    await eve.agent.get(`/api/doc/doc/${docId}/comments`).expect(404);
    await eve.agent.post(`/api/doc/doc/${docId}/comments`).send({ text: "hi" }).expect(404);

    await alice.agent.delete(`/api/doc/teamdocs/${docId}`).expect(200);
    await alice.agent.get(`/api/doc/doc/${docId}/comments`).expect(404);
  });

  it("show up in notifications with the doc's title", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    const docId = await newDoc(alice, "x");
    await bob.agent.post(`/api/doc/doc/${docId}/comments`).send({ text: "look" }).expect(201);
    await vi.waitFor(async () => {
      const n = (await alice.agent.get("/api/notifications").expect(200)).body;
      expect(n.items[0]).toMatchObject({ type: "doc_comment", docId, conversationName: "Live", preview: "look" });
    });
  });
});

describe("webhooks", () => {
  const hook = (u: TestUser, body: Record<string, unknown>) => u.agent.post("/api/workspaces/current/webhooks").send(body);

  it("admins manage them; the secret is shown once", async () => {
    const owner = await signUp(app, { team: TEAM_A });
    const member = await signUp(app, { team: TEAM_A });
    await hook(member, { name: "x", url: "https://example.com/h", events: ["doc.created"] }).expect(403);
    await hook(owner, { name: "x", url: "http://localhost:9/h", events: ["doc.created"] }).expect(400);
    await hook(owner, { name: "x", url: "https://example.com/h", events: [] }).expect(400);

    const created = await hook(owner, { name: "Docs feed", url: "https://example.com/h", format: "slack", events: ["doc.created"] }).expect(201);
    expect(created.body.secret).toMatch(/^whsec_.{20,}/);
    const list = (await owner.agent.get("/api/workspaces/current/webhooks").expect(200)).body;
    expect(list[0].secret).toMatch(/…$/);

    await owner.agent.patch(`/api/workspaces/current/webhooks/${created.body._id}`).send({ enabled: false }).expect(200);
    await owner.agent.delete(`/api/workspaces/current/webhooks/${created.body._id}`).expect(200);
    expect((await owner.agent.get("/api/workspaces/current/webhooks").expect(200)).body).toEqual([]);
  });

  it("delivers subscribed events, signed, and never private-channel messages", async () => {
    const owner = await signUp(app, { team: TEAM_A });
    const created = await hook(owner, { name: "All", url: "https://example.com/h", events: ["message.created", "doc.created"] }).expect(201);
    const secret = created.body.secret as string;

    const general = (await owner.agent.get("/api/conversations").expect(200)).body.find((c: { name?: string }) => c.name === "general");
    await owner.agent.post(`/api/conversations/${general._id}/messages`).send({ text: "hello hooks" }).expect(201);
    const priv = await owner.agent.post("/api/conversations/channels").send({ name: "quiet", isPrivate: true }).expect(201);
    await owner.agent.post(`/api/conversations/${priv.body._id}/messages`).send({ text: "shh" }).expect(201);
    await newDoc(owner, "x");

    await vi.waitFor(() => expect(posts).toHaveLength(2));
    const events = posts.map((p) => JSON.parse(p.body));
    expect(events.map((e) => e.event).sort()).toEqual(["doc.created", "message.created"]);
    const msg = events.find((e) => e.event === "message.created");
    expect(msg.data).toMatchObject({ channel: { name: "general" }, message: { text: "hello hooks" } });
    expect(posts.map((p) => p.body).join()).not.toContain("shh");

    const { sign } = await import("../../src/modules/webhooks/webhooks.service.js");
    const sent = posts[0]!;
    const t = Number(/t=(\d+)/.exec(sent.headers["x-projectteams-signature"]!)![1]);
    expect(sent.headers["x-projectteams-signature"]).toBe(sign(secret, sent.body, t));
  });

  it("test pings, logs deliveries, and switches off after repeated failures", async () => {
    const owner = await signUp(app, { team: TEAM_A });
    const created = await hook(owner, { name: "Flaky", url: "https://example.com/fail", events: ["doc.created"] }).expect(201);
    const id = created.body._id;

    const test = await owner.agent.post(`/api/workspaces/current/webhooks/${id}/test`).expect(200);
    expect(test.body).toMatchObject({ ok: false, statusCode: 500 });
    const log = (await owner.agent.get(`/api/workspaces/current/webhooks/${id}/deliveries`).expect(200)).body;
    expect(log[0]).toMatchObject({ event: "ping", status: "failed", statusCode: 500 });

    await Webhook.updateOne({ _id: id }, { $set: { failureCount: 19 } });
    await newDoc(owner, "x");
    await vi.waitFor(async () => {
      const h = await Webhook.findById(id).lean();
      expect(h?.enabled).toBe(false);
      expect(h?.disabledReason).toContain("20 failed");
    });

    // Turning it back on resets the count.
    await owner.agent.patch(`/api/workspaces/current/webhooks/${id}`).send({ enabled: true }).expect(200);
    expect((await Webhook.findById(id).lean())?.failureCount).toBe(0);
  });
});
