import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { Document } from "../../src/models/document.js";
import { Message } from "../../src/models/message.js";
import { clearDb, startDb, stopDb } from "../helpers/db.js";
import { signUp, TEAM_A, TEAM_B } from "../helpers/users.js";

const app = createApp();

beforeAll(async () => {
  await startDb();
  await Promise.all([Document.init(), Message.init()]); // text indexes
});
afterEach(clearDb);
afterAll(stopDb);

const rich = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

describe("search", () => {
  it("finds docs and messages you can see, and nothing else", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    const carol = await signUp(app, { team: TEAM_A });
    const mallory = await signUp(app, { team: TEAM_B });

    await alice.agent.post("/api/doc/create").send({ title: "Pricing strategy", contentJson: rich("Annual plans get two months free") }).expect(201);
    await mallory.agent.post("/api/doc/create").send({ title: "Pricing secrets", contentJson: rich("Theirs") }).expect(201);

    const general = (await alice.agent.get("/api/conversations")).body.find((c: { isDefault: boolean }) => c.isDefault);
    await alice.agent.post(`/api/conversations/${general._id}/messages`).send({ text: "Pricing page goes live Monday" }).expect(201);
    const dm = (await alice.agent.post("/api/conversations/direct").send({ userIds: [bob.id] })).body._id;
    await alice.agent.post(`/api/conversations/${dm}/messages`).send({ text: "Pricing discount for Acme is 20%" }).expect(201);

    const forAlice = (await alice.agent.get("/api/search?q=pricing").expect(200)).body;
    expect(forAlice.docs.map((d: { title: string }) => d.title)).toEqual(["Pricing strategy"]);
    expect(forAlice.messages).toHaveLength(2);

    // Carol isn't in the DM; Mallory is in another workspace.
    const forCarol = (await carol.agent.get("/api/search?q=pricing").expect(200)).body;
    expect(forCarol.messages.map((m: { where: string }) => m.where)).toEqual(["#general"]);
    const forMallory = (await mallory.agent.get("/api/search?q=pricing").expect(200)).body;
    expect(forMallory.docs.map((d: { title: string }) => d.title)).toEqual(["Pricing secrets"]);
    expect(forMallory.messages).toHaveLength(0);
  });

  it("matches partial words and ignores tiny queries", async () => {
    const alice = await signUp(app);
    await alice.agent.post("/api/doc/create").send({ title: "Onboarding checklist", contentJson: rich("x") }).expect(201);
    expect((await alice.agent.get("/api/search?q=onboard")).body.docs).toHaveLength(1);
    expect((await alice.agent.get("/api/search?q=o")).body.docs).toHaveLength(0);
  });
});
