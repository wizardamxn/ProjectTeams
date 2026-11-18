import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

const { calls } = vi.hoisted(() => ({ calls: [] as { system: string; prompt: string }[] }));
vi.mock("../../src/lib/ai.js", () => ({
  generate: vi.fn(async (input: { system: string; prompt: string }) => {
    calls.push(input);
    if (input.system.includes("wiki")) {
      return '{"title":"Pricing decision","blocks":[{"type":"paragraph","text":"We agreed on annual plans."},{"type":"tasks","items":["Priya: update page"]}]}';
    }
    if (input.system.includes("catching up")) return "- Annual plans approved";
    return "Annual plans get two months free [1].";
  }),
  embed: vi.fn(async (values: string[]) => values.map(() => [0.1, 0.2, 0.3])),
}));

const { createApp } = await import("../../src/app.js");
const { RagChunk } = await import("../../src/models/ragChunk.js");
const { Conversation } = await import("../../src/models/conversation.js");
const { knowledgeService } = await import("../../src/modules/knowledge/knowledge.service.js");
const { indexChat, indexDoc } = await import("../../src/modules/knowledge/indexer.js");
const { clearDb, startDb, stopDb } = await import("../helpers/db.js");
const { signUp, TEAM_A } = await import("../helpers/users.js");

const app = createApp();

beforeAll(startDb);
afterEach(async () => {
  calls.length = 0;
  await clearDb();
});
afterAll(stopDb);

const rich = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const generalOf = async (agent: Awaited<ReturnType<typeof signUp>>["agent"]) =>
  (await agent.get("/api/conversations")).body.find((c: { isDefault: boolean }) => c.isDefault)._id as string;

describe("indexer", () => {
  it("indexes a doc, and re-indexing replaces its chunks", async () => {
    const alice = await signUp(app);
    const doc = (await alice.agent.post("/api/doc/create").send({ title: "Pricing", contentJson: rich("Annual plans") })).body.document;
    expect(await indexDoc(doc._id)).toBe(1);
    expect(await indexDoc(doc._id)).toBe(1);
    const chunks = await RagChunk.find({ sourceId: doc._id }).lean();
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ sourceType: "doc", title: "Pricing", teamId: alice.workspaceId });

    await alice.agent.delete(`/api/doc/teamdocs/${doc._id}`).expect(200);
    expect(await RagChunk.countDocuments({ sourceId: doc._id })).toBe(0);
  });

  it("indexes public channels incrementally, never private ones or DMs", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    const general = await generalOf(alice.agent);
    await alice.agent.post(`/api/conversations/${general}/messages`).send({ text: "Launch is Monday" }).expect(201);
    expect(await indexChat(general, false)).toBe(1);
    expect(await indexChat(general, false)).toBe(0); // nothing new

    await bob.agent.post(`/api/conversations/${general}/messages`).send({ text: "Blog post ready" }).expect(201);
    expect(await indexChat(general, false)).toBe(1);
    const texts = (await RagChunk.find({ sourceId: general }).sort({ chunkIndex: 1 }).lean()).map((c) => c.text);
    expect(texts[1]).toMatch(/Blog post ready/);

    const secret = (await alice.agent.post("/api/conversations/channels").send({ name: "hush", isPrivate: true })).body._id;
    await alice.agent.post(`/api/conversations/${secret}/messages`).send({ text: "salaries" }).expect(201);
    expect(await indexChat(secret, false)).toBe(0);
    const dm = (await alice.agent.post("/api/conversations/direct").send({ userIds: [bob.id] })).body._id;
    await alice.agent.post(`/api/conversations/${dm}/messages`).send({ text: "private" }).expect(201);
    expect(await indexChat(dm, false)).toBe(0);
    expect(await RagChunk.countDocuments({ text: /salaries|private/ })).toBe(0);
  });

  it("a full rebuild drops deleted messages", async () => {
    const alice = await signUp(app);
    const general = await generalOf(alice.agent);
    const m = (await alice.agent.post(`/api/conversations/${general}/messages`).send({ text: "oops secret" })).body;
    await indexChat(general, false);
    await alice.agent.delete(`/api/messages/${m._id}`).expect(200);
    await indexChat(general, true);
    expect(await RagChunk.countDocuments({ text: /oops secret/ })).toBe(0);
    expect((await Conversation.findById(general))?.indexedUntil).toBeUndefined();
  });
});

describe("Ask", () => {
  it("answers with numbered, linkable sources", async () => {
    const alice = await signUp(app);
    const docId = new Types.ObjectId();
    const spy = vi.spyOn(knowledgeService, "search").mockResolvedValue([
      { _id: new Types.ObjectId(), text: "Annual plans get two months free", score: 0.9, sourceType: "doc", sourceId: docId, title: "Pricing" },
    ]);
    const res = await alice.agent.post("/api/ai/ask-docs").send({ question: "What's the annual discount?" }).expect(200);
    spy.mockRestore();
    expect(res.body.answer).toContain("[1]");
    expect(res.body.sources[0]).toMatchObject({ n: 1, type: "doc", title: "Pricing", docId: docId.toString() });
    expect(calls[0]!.prompt).toContain("(doc: Pricing)");
  });

  it("says so when nothing matches", async () => {
    const alice = await signUp(app);
    const spy = vi.spyOn(knowledgeService, "search").mockResolvedValue([]);
    const res = await alice.agent.post("/api/ai/ask-docs").send({ question: "?" }).expect(200);
    spy.mockRestore();
    expect(res.body.sources).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("reports what is indexed", async () => {
    const alice = await signUp(app);
    await alice.agent.post("/api/doc/create").send({ title: "A", contentJson: rich("x") });
    await generalOf(alice.agent);
    expect((await alice.agent.get("/api/upload/stats").expect(200)).body).toEqual({ docs: 1, files: 0, channels: 1 });
  });
});

describe("catch up and thread → doc", () => {
  it("summarises recent messages in a conversation you're in", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    const general = await generalOf(alice.agent);
    await bob.agent.post(`/api/conversations/${general}/messages`).send({ text: "Annual plans approved" }).expect(201);

    const res = await alice.agent.post("/api/ai/catch-up").send({ conversationId: general }).expect(200);
    expect(res.body).toMatchObject({ summary: "- Annual plans approved", count: 1 });
    expect(calls[0]!.prompt).toMatch(/: Annual plans approved/);

    const secret = (await bob.agent.post("/api/conversations/channels").send({ name: "hush", isPrivate: true })).body._id;
    await alice.agent.post("/api/ai/catch-up").send({ conversationId: secret }).expect(404);
  });

  it("returns no summary when nothing happened", async () => {
    const alice = await signUp(app);
    const general = await generalOf(alice.agent);
    const res = await alice.agent.post("/api/ai/catch-up").send({ conversationId: general }).expect(200);
    expect(res.body).toMatchObject({ summary: null, count: 0 });
  });

  it("turns a thread into a doc", async () => {
    const alice = await signUp(app);
    const general = await generalOf(alice.agent);
    const root = (await alice.agent.post(`/api/conversations/${general}/messages`).send({ text: "Annual or monthly?" })).body;
    await alice.agent.post(`/api/conversations/${general}/messages`).send({ text: "Annual", threadRootId: root._id });

    const created = await alice.agent.post("/api/ai/thread-to-doc").send({ conversationId: general, rootId: root._id }).expect(201);
    expect(created.body.title).toBe("Pricing decision");
    const doc = (await alice.agent.get(`/api/doc/doc/${created.body._id}`).expect(200)).body;
    expect(doc.content).toContain("We agreed on annual plans.");
    expect(doc.content).toContain("[ ] Priya: update page");
    expect(doc.content).toContain("Written from a thread in #general");
    expect(doc.tags).toEqual(["from-chat"]);
  });
});
