import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import type { Response } from "supertest";

const { files, removed } = vi.hoisted(() => ({ files: new Map<string, Buffer>(), removed: [] as string[] }));
vi.mock("../../src/lib/storage.js", () => ({
  storage: {
    upload: vi.fn(async (path: string, data: Buffer) => void files.set(path, data)),
    download: vi.fn(async (path: string) => {
      const f = files.get(path);
      if (!f) throw new Error("missing");
      return f;
    }),
    remove: vi.fn(async (path: string) => void removed.push(path)),
    signedUrls: vi.fn(async (paths: string[]) => paths.map(() => null)),
  },
}));
vi.mock("../../src/queues/ragQueue.js", () => ({
  enqueueIngest: vi.fn(async () => null),
  enqueueDocIndex: vi.fn(async () => null),
  enqueueChatIndex: vi.fn(async () => null),
}));
vi.mock("../../src/lib/mailer.js", () => ({ sendMail: vi.fn(async () => undefined) }));

const { createApp } = await import("../../src/app.js");
const { AuditEvent } = await import("../../src/models/auditEvent.js");
const { Document } = await import("../../src/models/document.js");
const { Message } = await import("../../src/models/message.js");
const { Membership } = await import("../../src/models/membership.js");
const { Workspace } = await import("../../src/models/workspace.js");
const { clearDb, startDb, stopDb } = await import("../helpers/db.js");
const { signUp, TEAM_A } = await import("../helpers/users.js");

const app = createApp();

beforeAll(startDb);
afterEach(async () => {
  files.clear();
  removed.length = 0;
  await clearDb();
});
afterAll(stopDb);

type Agent = Awaited<ReturnType<typeof signUp>>["agent"];

const binary = (res: Response, cb: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on("data", (c: Buffer) => chunks.push(c));
  res.on("end", () => cb(null, Buffer.concat(chunks)));
};
const getZip = async (agent: Agent, url: string) => {
  const res = await agent.get(url).buffer(true).parse(binary as never).expect(200);
  expect(res.headers["content-type"]).toBe("application/zip");
  const entries = unzipSync(new Uint8Array(res.body as Buffer));
  return Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, v]));
};
const text = (entries: Record<string, Uint8Array>, name: string) => {
  const e = entries[name];
  if (!e) throw new Error(`No ${name} in zip. Have: ${Object.keys(entries).join(", ")}`);
  return strFromU8(e);
};

const generalId = async (agent: Agent) => {
  const list = await agent.get("/api/conversations").expect(200);
  return list.body.find((c: { name?: string }) => c.name === "general")._id as string;
};

/** Audit writes don't block the request; wait for them to land. */
const auditActions = async (workspaceId: string, n: number) => {
  await vi.waitFor(async () => expect(await AuditEvent.countDocuments({ workspaceId })).toBeGreaterThanOrEqual(n));
  return (await AuditEvent.find({ workspaceId }).sort({ _id: 1 }).lean()).map((e) => e.action);
};

describe("audit log", () => {
  it("records admin actions, and only admins can read it", async () => {
    const owner = await signUp(app, { team: TEAM_A, name: "Olivia" });
    const member = await signUp(app, { team: TEAM_A, name: "Max" });

    await owner.agent.patch("/api/workspaces/current").send({ name: "Renamed" }).expect(200);
    await owner.agent.patch(`/api/workspaces/current/members/${member.id}`).send({ role: "admin" }).expect(200);
    await owner.agent.delete(`/api/workspaces/current/members/${member.id}`).expect(200);

    const actions = await auditActions(owner.workspaceId, 5);
    // signUp itself created an invite and the member joined through it.
    expect(actions).toEqual(["invite.created", "member.joined", "workspace.renamed", "member.role_changed", "member.removed"]);

    const list = await owner.agent.get("/api/workspaces/current/audit").expect(200);
    expect(list.body.items[0]).toMatchObject({
      action: "member.removed",
      actor: { _id: owner.id, name: owner.profile.fullName },
      target: { type: "member", id: member.id },
    });
    expect(list.body.items[0].target.label).toContain(member.email);
    const renamed = list.body.items.find((e: { action: string }) => e.action === "workspace.renamed");
    expect(renamed.meta).toEqual({ from: "Workspace A", to: "Renamed" });

    const joiner = await signUp(app, { team: TEAM_A });
    await joiner.agent.get("/api/workspaces/current/audit").expect(403);
    await joiner.agent.get("/api/workspaces/current/audit.csv").expect(403);
  });

  it("filters, pages, and downloads as CSV", async () => {
    const owner = await signUp(app, { team: TEAM_A });
    for (const name of ["one", "two", "three"]) {
      await owner.agent.post("/api/conversations/channels").send({ name }).expect(201);
    }
    await owner.agent.patch("/api/workspaces/current").send({ name: "=HYPERLINK(\"x\")" }).expect(200);
    await auditActions(owner.workspaceId, 4);

    const page1 = await owner.agent.get("/api/workspaces/current/audit?action=channel.created&limit=2").expect(200);
    expect(page1.body.items.map((e: { target: { label: string } }) => e.target.label)).toEqual(["#three", "#two"]);
    expect(page1.body.nextCursor).toBeTruthy();
    const page2 = await owner.agent.get(`/api/workspaces/current/audit?action=channel.created&limit=2&before=${page1.body.nextCursor}`).expect(200);
    expect(page2.body.items.map((e: { target: { label: string } }) => e.target.label)).toEqual(["#one"]);
    expect(page2.body.nextCursor).toBeNull();

    await owner.agent.get("/api/workspaces/current/audit?action=not.real").expect(400);

    const csv = await owner.agent.get("/api/workspaces/current/audit.csv").expect(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    const lines = csv.text.trim().split("\r\n");
    expect(lines[0]).toBe("time,actor,actor_id,action,target_type,target,target_id,details,ip");
    expect(lines).toHaveLength(5);
    // Spreadsheet formulas are defused.
    expect(lines[1]).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it("is per workspace", async () => {
    const a = await signUp(app, { team: TEAM_A });
    const b = await signUp(app, { team: "B" });
    await a.agent.patch("/api/workspaces/current").send({ name: "Alpha" }).expect(200);
    await auditActions(a.workspaceId, 1);
    const list = await b.agent.get("/api/workspaces/current/audit").expect(200);
    expect(list.body.items).toEqual([]);
  });
});

describe("workspace export", () => {
  it("zips docs as Markdown, public channels, members and files; leaves private conversations out", async () => {
    const owner = await signUp(app, { team: TEAM_A, name: "Olivia" });
    const member = await signUp(app, { team: TEAM_A, name: "Max" });

    await owner.agent.post("/api/doc/folders").send({ name: "Launch" }).expect(201);
    const folders = await owner.agent.get("/api/doc/folders").expect(200);
    await owner.agent
      .post("/api/doc/create")
      .send({
        title: "Launch plan",
        folderId: folders.body[0]._id,
        contentJson: {
          type: "doc",
          content: [
            { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Owners" }] },
            { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Max", marks: [{ type: "bold" }] }] }] }] },
          ],
        },
      })
      .expect(201);

    const general = await generalId(owner.agent);
    await owner.agent.post(`/api/conversations/${general}/messages`).send({ text: "hello team" }).expect(201);
    const secret = await owner.agent.post("/api/conversations/channels").send({ name: "secret", isPrivate: true }).expect(201);
    await owner.agent.post(`/api/conversations/${secret.body._id}/messages`).send({ text: "private stuff" }).expect(201);
    const dm = await owner.agent.post("/api/conversations/direct").send({ userIds: [member.id] }).expect(200);
    await owner.agent.post(`/api/conversations/${dm.body._id}/messages`).send({ text: "just us" }).expect(201);

    await owner.agent.post("/api/upload/document").attach("document", Buffer.from("hello file"), "notes.txt").expect(201);

    const zip = await getZip(owner.agent, "/api/workspaces/current/export");
    const names = Object.keys(zip);

    expect(names).toEqual(expect.arrayContaining(["README.txt", "workspace.json", "members.json", "docs/index.json", "channels/index.json", "files/index.json", "missing-files.txt"]));
    const docPath = names.find((n) => n.startsWith("docs/Launch/Launch plan"))!;
    expect(text(zip, docPath)).toContain("# Launch plan\n\n## Owners\n\n- **Max**");

    const members = JSON.parse(text(zip, "members.json"));
    expect(members.map((m: { role: string }) => m.role).sort()).toEqual(["member", "owner"]);

    const channels = JSON.parse(text(zip, "channels/index.json"));
    expect(channels.map((c: { name: string }) => c.name)).toEqual(["general"]);
    const lines = text(zip, "channels/general/messages.jsonl").trim().split("\n").map((l) => JSON.parse(l));
    expect(lines).toEqual([expect.objectContaining({ text: "hello team", author: owner.profile.fullName })]);

    const all = names.map((n) => strFromU8(zip[n]!)).join("\n");
    expect(all).not.toContain("private stuff");
    expect(all).not.toContain("just us");

    const fileEntry = names.find((n) => n.startsWith("files/") && n.endsWith("notes.txt"))!;
    expect(text(zip, fileEntry)).toBe("hello file");
    expect(text(zip, "missing-files.txt")).toBe("None.\n");

    await vi.waitFor(async () => expect(await AuditEvent.exists({ action: "workspace.exported" })).toBeTruthy());
  });

  it("?files=0 lists files without their contents; members can't export", async () => {
    const owner = await signUp(app, { team: TEAM_A });
    const member = await signUp(app, { team: TEAM_A });
    await owner.agent.post("/api/upload/document").attach("document", Buffer.from("x"), "a.txt").expect(201);

    const zip = await getZip(owner.agent, "/api/workspaces/current/export?files=0");
    expect(Object.keys(zip).filter((n) => n.startsWith("files/"))).toEqual(["files/index.json"]);
    expect(JSON.parse(text(zip, "files/index.json"))[0].fileName).toBe("a.txt");

    await member.agent.get("/api/workspaces/current/export").expect(403);
  });

  it("notes files it couldn't read instead of failing", async () => {
    const owner = await signUp(app, { team: TEAM_A });
    await owner.agent.post("/api/upload/document").attach("document", Buffer.from("x"), "gone.txt").expect(201);
    files.clear();
    const zip = await getZip(owner.agent, "/api/workspaces/current/export");
    expect(text(zip, "missing-files.txt")).toContain("gone.txt");
  });
});

describe("personal export", () => {
  it("has your profile, your docs and every message you sent, DMs included", async () => {
    const owner = await signUp(app, { team: TEAM_A });
    const member = await signUp(app, { team: TEAM_A });
    await member.agent.post("/api/doc/create").send({ title: "Mine", content: "my words" }).expect(201);
    await owner.agent.post("/api/doc/create").send({ title: "Theirs", content: "not mine" }).expect(201);
    const dm = await member.agent.post("/api/conversations/direct").send({ userIds: [owner.id] }).expect(200);
    await member.agent.post(`/api/conversations/${dm.body._id}/messages`).send({ text: "psst" }).expect(201);
    await owner.agent.post(`/api/conversations/${dm.body._id}/messages`).send({ text: "reply" }).expect(201);

    const zip = await getZip(member.agent, "/api/me/export");
    const profile = JSON.parse(text(zip, "profile.json"));
    expect(profile).toMatchObject({ email: member.email, signInMethods: ["password"] });
    expect(JSON.stringify(profile)).not.toContain("$2"); // no password hash

    const docs = Object.keys(zip).filter((n) => n.startsWith("docs/"));
    expect(docs).toHaveLength(1);
    expect(text(zip, docs[0]!)).toContain("my words");

    const messages = text(zip, "messages.jsonl").trim().split("\n").map((l) => JSON.parse(l));
    expect(messages).toEqual([expect.objectContaining({ text: "psst", conversation: "Direct message" })]);
  });

  it("needs a login", async () => {
    const { default: request } = await import("supertest");
    await request(app).get("/api/me/export").expect(401);
  });
});

describe("delete workspace", () => {
  it("only the owner, only with the exact name; then everything is gone", async () => {
    const owner = await signUp(app, { team: TEAM_A });
    const admin = await signUp(app, { team: TEAM_A });
    await owner.agent.patch(`/api/workspaces/current/members/${admin.id}`).send({ role: "admin" }).expect(200);

    await owner.agent.post("/api/doc/create").send({ title: "Doc", content: "x" }).expect(201);
    const general = await generalId(owner.agent);
    await owner.agent.post(`/api/conversations/${general}/messages`).send({ text: "hi" }).expect(201);
    await owner.agent.post("/api/upload/document").attach("document", Buffer.from("x"), "f.txt").expect(201);

    await admin.agent.delete("/api/workspaces/current").send({ confirmName: "Workspace A" }).expect(403);
    await owner.agent.delete("/api/workspaces/current").send({ confirmName: "workspace a" }).expect(400);
    await owner.agent.delete("/api/workspaces/current").send({}).expect(400);

    await owner.agent.delete("/api/workspaces/current").send({ confirmName: "Workspace A" }).expect(200);

    expect(await Workspace.countDocuments()).toBe(0);
    expect(await Membership.countDocuments()).toBe(0);
    expect(await Document.countDocuments()).toBe(0);
    expect(await Message.countDocuments()).toBe(0);
    expect(await AuditEvent.countDocuments()).toBe(0);
    await vi.waitFor(() => expect(removed).toHaveLength(1));

    for (const u of [owner, admin]) {
      const me = await u.agent.get("/api/me").expect(200);
      expect(me.body.workspace).toBeNull();
    }
  });

  it("leaves other workspaces alone", async () => {
    const a = await signUp(app, { team: TEAM_A });
    const b = await signUp(app, { team: "B" });
    await b.agent.post("/api/doc/create").send({ title: "B doc", content: "x" }).expect(201);
    await a.agent.delete("/api/workspaces/current").send({ confirmName: "Workspace A" }).expect(200);
    expect((await b.agent.get("/api/doc/teamdocs").expect(200)).body).toHaveLength(1);
  });
});
