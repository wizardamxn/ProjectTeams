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
    const versions = (await bob.agent.get(`/api/doc/doc/${doc._id}/versions`).expect(200)).body;
    expect(versions).toHaveLength(1);

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

/* ---------------- Phase 5: rich text, history, stars, folders ---------------- */

import { Document } from "../../src/models/document.js";
import { DocumentVersion } from "../../src/models/documentVersion.js";

const rich = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

describe("rich text docs", () => {
  it("stores editor JSON and derives the plain text on the server", async () => {
    const alice = await signUp(app);
    const res = await alice.agent
      .post("/api/doc/create")
      .send({ title: "Plan", contentJson: rich("Ship Friday"), content: "client text is ignored" })
      .expect(201);
    expect(res.body.document.content).toBe("Ship Friday");
    const full = (await alice.agent.get(`/api/doc/doc/${res.body.document._id}`).expect(200)).body;
    expect(full.contentJson).toEqual(rich("Ship Friday"));
  });

  it("opens old plain-text docs as rich text", async () => {
    const alice = await signUp(app);
    const doc = await createDoc(alice.agent);
    const full = (await alice.agent.get(`/api/doc/doc/${doc._id}`).expect(200)).body;
    expect(full.contentJson.type).toBe("doc");
  });

  it("refuses content that isn't an editor document", async () => {
    const alice = await signUp(app);
    await alice.agent.post("/api/doc/create").send({ title: "x", contentJson: { type: "evil" } }).expect(400);
  });

  it("lists without the full content", async () => {
    const alice = await signUp(app);
    await alice.agent.post("/api/doc/create").send({ title: "Long", contentJson: rich("x".repeat(1000)) }).expect(201);
    const [listed] = (await alice.agent.get("/api/doc/list").expect(200)).body;
    expect(listed.contentJson).toBeUndefined();
    expect(listed.content.length).toBeLessThanOrEqual(300);
  });
});

describe("version history", () => {
  it("keeps one snapshot per editor per 10 minutes, and restore is undoable", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    const id = (await alice.agent.post("/api/doc/create").send({ title: "Doc", contentJson: rich("v1") })).body.document._id;

    // Autosave bursts from the same person: one snapshot (of v1).
    await alice.agent.put(`/api/doc/edit/${id}`).send({ contentJson: rich("v2") }).expect(200);
    await alice.agent.put(`/api/doc/edit/${id}`).send({ contentJson: rich("v3") }).expect(200);
    expect(await DocumentVersion.countDocuments({ documentId: id })).toBe(1);

    // A different editor always gets a snapshot of the state before them.
    await bob.agent.put(`/api/doc/edit/${id}`).send({ contentJson: rich("v4") }).expect(200);
    const versions = (await alice.agent.get(`/api/doc/doc/${id}/versions`).expect(200)).body;
    expect(versions.map((v: { preview: string }) => v.preview)).toEqual(["v3", "v1"]);
    expect(versions[0].editedBy._id).toBe(alice.id);

    const v1 = versions[1]._id;
    expect((await bob.agent.get(`/api/doc/doc/${id}/versions/${v1}`).expect(200)).body.contentJson).toEqual(rich("v1"));
    const restored = await bob.agent.post(`/api/doc/doc/${id}/versions/${v1}/restore`).expect(200);
    expect(restored.body.content).toBe("v1");
    // The state before the restore (v4) is now in history.
    const after = (await alice.agent.get(`/api/doc/doc/${id}/versions`)).body;
    expect(after[0].preview).toBe("v4");
  });

  it("other workspaces can't see a doc's history", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const mallory = await signUp(app, { team: TEAM_B });
    const doc = await createDoc(alice.agent);
    await mallory.agent.get(`/api/doc/doc/${doc._id}/versions`).expect(404);
  });

  it("moves pre-Phase-5 embedded versions into history", async () => {
    const alice = await signUp(app);
    const doc = await createDoc(alice.agent);
    await Document.updateOne({ _id: doc._id }, { $set: { versions: [{ content: "ancient", updatedAt: new Date("2025-01-01") }] } });
    const versions = (await alice.agent.get(`/api/doc/doc/${doc._id}/versions`).expect(200)).body;
    expect(versions[0].preview).toBe("ancient");
    expect((await Document.findById(doc._id).lean())?.versions ?? []).toHaveLength(0);
  });
});

describe("stars are personal", () => {
  it("one person's star doesn't star it for everyone", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    const doc = await createDoc(alice.agent);
    const res = await alice.agent.put(`/api/doc/star/${doc._id}`).expect(200);
    expect(res.body.starred).toBe(true);
    expect((await alice.agent.get("/api/doc/starred")).body).toHaveLength(1);
    expect((await bob.agent.get("/api/doc/starred")).body).toHaveLength(0);
    expect((await bob.agent.get(`/api/doc/doc/${doc._id}`)).body.starred).toBe(false);
  });

  it("old team-wide stars become the author's", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    const doc = await createDoc(alice.agent);
    await Document.updateOne({ _id: doc._id }, { $set: { starred: true } });
    expect((await alice.agent.get("/api/doc/starred")).body).toHaveLength(1);
    expect((await bob.agent.get("/api/doc/starred")).body).toHaveLength(0);
  });
});

describe("folders", () => {
  it("create, file docs, filter, rename and delete (docs survive)", async () => {
    const alice = await signUp(app);
    const folder = (await alice.agent.post("/api/doc/folders").send({ name: "Specs" }).expect(201)).body;
    await alice.agent.post("/api/doc/folders").send({ name: "specs" }).expect(409); // case-insensitive

    const inFolder = (await alice.agent.post("/api/doc/create").send({ title: "API", content: "x", folderId: folder._id })).body.document;
    await createDoc(alice.agent, "Loose");
    expect((await alice.agent.get(`/api/doc/list?folderId=${folder._id}`)).body.map((d: { title: string }) => d.title)).toEqual(["API"]);
    expect((await alice.agent.get("/api/doc/list?folderId=none")).body.map((d: { title: string }) => d.title)).toEqual(["Loose"]);
    expect((await alice.agent.get("/api/doc/folders")).body[0]).toMatchObject({ name: "Specs", docCount: 1 });

    await alice.agent.patch(`/api/doc/folders/${folder._id}`).send({ name: "Specs v2" }).expect(200);
    await alice.agent.delete(`/api/doc/folders/${folder._id}`).expect(200);
    const doc = (await alice.agent.get(`/api/doc/doc/${inFolder._id}`).expect(200)).body;
    expect(doc.folderId).toBeNull();
  });

  it("can't file a doc into another workspace's folder", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const mallory = await signUp(app, { team: TEAM_B });
    const theirs = (await mallory.agent.post("/api/doc/folders").send({ name: "Theirs" })).body;
    await alice.agent.post("/api/doc/create").send({ title: "x", content: "y", folderId: theirs._id }).expect(400);
  });
});
