import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { clearDb, startDb, stopDb } from "../helpers/db.js";
import { signUp, TEAM_A, TEAM_B } from "../helpers/users.js";

const app = createApp();

beforeAll(startDb);
afterEach(clearDb);
afterAll(stopDb);

const createDoc = async (agent: Awaited<ReturnType<typeof signUp>>["agent"], title = "Plan") => {
  const res = await agent.post("/api/doc/create").send({ title, content: "Body", tags: ["a", "a", " b "] }).expect(201);
  return res.body.document as { _id: string; teamId: string; tags: string[] };
};

describe("documents", () => {
  it("creates a doc owned by the caller's workspace, with clean tags", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const doc = await createDoc(alice.agent);
    expect(doc.teamId).toBe(alice.workspaceId);
    expect(doc.tags).toEqual(["a", "b"]);
  });

  it("ignores ownership fields sent by the client", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const res = await alice.agent
      .post("/api/doc/create")
      .send({ title: "x", content: "y", teamId: "somewhere-else", createdBy: "64b0000000000000000000aa" })
      .expect(201);
    expect(res.body.document.teamId).toBe(alice.workspaceId);
    expect(res.body.document.createdBy).toBe(alice.id);
  });

  it("teammates can see and edit each other's docs", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    const doc = await createDoc(alice.agent);

    await bob.agent.get(`/api/doc/doc/${doc._id}`).expect(200);
    const edited = await bob.agent.put(`/api/doc/edit/${doc._id}`).send({ content: "v2" }).expect(200);
    expect(edited.body.content).toBe("v2");
    expect(edited.body.versions).toHaveLength(1);

    const team = await bob.agent.get("/api/doc/teamdocs").expect(200);
    expect(team.body).toHaveLength(1);
  });

  it("another team cannot read, edit, star or delete the doc", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const mallory = await signUp(app, { team: TEAM_B });
    const doc = await createDoc(alice.agent);

    await mallory.agent.get(`/api/doc/doc/${doc._id}`).expect(404);
    await mallory.agent.put(`/api/doc/edit/${doc._id}`).send({ title: "pwned" }).expect(404);
    await mallory.agent.put(`/api/doc/star/${doc._id}`).expect(404);
    await mallory.agent.delete(`/api/doc/teamdocs/${doc._id}`).expect(404);

    const list = await mallory.agent.get("/api/doc/teamdocs").expect(200);
    expect(list.body).toHaveLength(0);

    const still = await alice.agent.get(`/api/doc/doc/${doc._id}`).expect(200);
    expect(still.body.title).toBe("Plan");
  });

  it("edit cannot move a doc to another team", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const doc = await createDoc(alice.agent);
    const res = await alice.agent.put(`/api/doc/edit/${doc._id}`).send({ teamId: "somewhere-else", title: "t2" }).expect(200);
    expect(res.body.teamId).toBe(alice.workspaceId);
    expect(res.body.title).toBe("t2");
  });

  it("invalid ids are 404s, not 500s", async () => {
    const alice = await signUp(app);
    await alice.agent.get("/api/doc/doc/not-an-id").expect(404);
  });

  it("star toggles and shows in starred", async () => {
    const alice = await signUp(app);
    const doc = await createDoc(alice.agent);
    await alice.agent.put(`/api/doc/star/${doc._id}`).expect(200);
    const starred = await alice.agent.get("/api/doc/starred").expect(200);
    expect(starred.body.map((d: { _id: string }) => d._id)).toEqual([doc._id]);
  });

  it("only the author or an admin can delete a doc", async () => {
    const owner = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    const carol = await signUp(app, { team: TEAM_A });
    const bobsDoc = await createDoc(bob.agent, "Bob's");
    const carolsDoc = await createDoc(carol.agent, "Carol's");

    await carol.agent.delete(`/api/doc/teamdocs/${bobsDoc._id}`).expect(403);
    await bob.agent.delete(`/api/doc/teamdocs/${bobsDoc._id}`).expect(200); // author
    await owner.agent.delete(`/api/doc/teamdocs/${carolsDoc._id}`).expect(200); // owner
  });

  it("rejects missing title/content", async () => {
    const alice = await signUp(app);
    await alice.agent.post("/api/doc/create").send({ title: "" , content: "x" }).expect(400);
  });
});
