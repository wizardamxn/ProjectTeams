import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

const { sent } = vi.hoisted(() => ({ sent: [] as { to: string; text: string }[] }));
vi.mock("../../src/lib/mailer.js", () => ({
  sendMail: vi.fn(async (mail: { to: string; text: string }) => void sent.push(mail)),
}));

const { createApp } = await import("../../src/app.js");
const { Invite } = await import("../../src/models/invite.js");
const { clearDb, startDb, stopDb } = await import("../helpers/db.js");
const { createInvite, registerUser, signUp, TEAM_A, TEAM_B } = await import("../helpers/users.js");

const app = createApp();

beforeAll(startDb);
afterEach(async () => {
  sent.length = 0;
  await clearDb();
});
afterAll(stopDb);

describe("onboarding", () => {
  it("a new account has no workspace; data routes say so", async () => {
    const user = await registerUser(app);
    const me = await user.agent.get("/api/me").expect(200);
    expect(me.body.workspace).toBeNull();
    expect(me.body.workspaces).toEqual([]);

    const res = await user.agent.get("/api/doc/teamdocs").expect(409);
    expect(res.body.code).toBe("no_workspace");
  });

  it("creating a workspace makes you its owner and switches you into it", async () => {
    const user = await registerUser(app);
    const created = await user.agent.post("/api/workspaces").send({ name: "  Acme  " }).expect(201);
    expect(created.body).toMatchObject({ name: "Acme", role: "owner" });

    const me = await user.agent.get("/api/me").expect(200);
    expect(me.body.workspace.name).toBe("Acme");
    expect(me.body.role).toBe("owner");
  });

  it("you can belong to several workspaces and switch between them", async () => {
    const user = await registerUser(app);
    const a = (await user.agent.post("/api/workspaces").send({ name: "Alpha" }).expect(201)).body;
    const b = (await user.agent.post("/api/workspaces").send({ name: "Beta" }).expect(201)).body;

    await user.agent.post("/api/doc/create").send({ title: "In Beta", content: "x" }).expect(201);
    await user.agent.post(`/api/workspaces/${a._id}/switch`).expect(200);
    expect((await user.agent.get("/api/doc/teamdocs").expect(200)).body).toHaveLength(0);

    await user.agent.post(`/api/workspaces/${b._id}/switch`).expect(200);
    expect((await user.agent.get("/api/doc/teamdocs").expect(200)).body).toHaveLength(1);

    const list = await user.agent.get("/api/workspaces").expect(200);
    expect(list.body.map((w: { name: string }) => w.name)).toEqual(["Alpha", "Beta"]);
  });

  it("can't switch into a workspace you don't belong to", async () => {
    const owner = await signUp(app, { team: TEAM_A });
    const stranger = await signUp(app, { team: TEAM_B });
    await stranger.agent.post(`/api/workspaces/${owner.workspaceId}/switch`).expect(404);
  });
});

describe("invite links", () => {
  it("preview shows the workspace, accepting joins it as a member", async () => {
    const owner = await signUp(app, { team: TEAM_A });
    const token = await createInvite(owner);

    const preview = await request(app).get(`/api/invites/${token}`).expect(200);
    expect(preview.body).toMatchObject({ workspace: { name: "Workspace A", memberCount: 1 }, role: "member" });

    const bob = await registerUser(app);
    await bob.agent.post(`/api/invites/${token}/accept`).expect(200);
    const me = await bob.agent.get("/api/me").expect(200);
    expect(me.body).toMatchObject({ workspace: { _id: owner.workspaceId }, role: "member" });
  });

  it("a revoked, expired or used-up link stops working", async () => {
    const owner = await signUp(app, { team: TEAM_A });

    const revoked = await owner.agent.post("/api/workspaces/current/invites").send({}).expect(201);
    await owner.agent.delete(`/api/workspaces/current/invites/${revoked.body._id}`).expect(200);
    await request(app).get(`/api/invites/${revoked.body.url.split("/invite/")[1]}`).expect(404);

    const expiredToken = await createInvite(owner);
    await Invite.updateOne({ token: expiredToken }, { expiresAt: new Date(Date.now() - 1000) });
    const late = await registerUser(app);
    await late.agent.post(`/api/invites/${expiredToken}/accept`).expect(404);

    const once = await createInvite(owner, { maxUses: 1 });
    await (await registerUser(app)).agent.post(`/api/invites/${once}/accept`).expect(200);
    await (await registerUser(app)).agent.post(`/api/invites/${once}/accept`).expect(404);
  });

  it("accepting twice doesn't use the link up again", async () => {
    const owner = await signUp(app, { team: TEAM_A });
    const token = await createInvite(owner, { maxUses: 2 });
    const bob = await registerUser(app);
    await bob.agent.post(`/api/invites/${token}/accept`).expect(200);
    const again = await bob.agent.post(`/api/invites/${token}/accept`).expect(200);
    expect(again.body.alreadyMember).toBe(true);
    await (await registerUser(app)).agent.post(`/api/invites/${token}/accept`).expect(200);
  });

  it("an email invite is emailed and only works for that address", async () => {
    const owner = await signUp(app, { team: TEAM_A });
    const invitee = await registerUser(app);
    const other = await registerUser(app);

    const res = await owner.agent
      .post("/api/workspaces/current/invites")
      .send({ email: invitee.email.toUpperCase() })
      .expect(201);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe(invitee.email);
    const token = res.body.url.split("/invite/")[1];

    await other.agent.post(`/api/invites/${token}/accept`).expect(403);
    await invitee.agent.post(`/api/invites/${token}/accept`).expect(200);
  });

  it("members can't create invites; admins can't create admin invites", async () => {
    const owner = await signUp(app, { team: TEAM_A });
    const member = await signUp(app, { team: TEAM_A });
    await member.agent.post("/api/workspaces/current/invites").send({}).expect(403);
    await member.agent.get("/api/workspaces/current/invites").expect(403);

    await owner.agent.patch(`/api/workspaces/current/members/${member.id}`).send({ role: "admin" }).expect(200);
    await member.agent.post("/api/workspaces/current/invites").send({}).expect(201);
    await member.agent.post("/api/workspaces/current/invites").send({ role: "admin" }).expect(403);
  });
});

describe("roles and membership", () => {
  it("lists members with their roles", async () => {
    const owner = await signUp(app, { team: TEAM_A, name: "Olive" });
    await signUp(app, { team: TEAM_A, name: "Bob" });
    const res = await owner.agent.get("/api/workspaces/current/members").expect(200);
    expect(res.body.map((m: { role: string }) => m.role).sort()).toEqual(["member", "owner"]);
  });

  it("only the owner changes roles, and making someone owner transfers ownership", async () => {
    const owner = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    const carol = await signUp(app, { team: TEAM_A });

    await bob.agent.patch(`/api/workspaces/current/members/${carol.id}`).send({ role: "admin" }).expect(403);
    await owner.agent.patch(`/api/workspaces/current/members/${owner.id}`).send({ role: "member" }).expect(400);

    await owner.agent.patch(`/api/workspaces/current/members/${bob.id}`).send({ role: "owner" }).expect(200);
    expect((await bob.agent.get("/api/me")).body.role).toBe("owner");
    expect((await owner.agent.get("/api/me")).body.role).toBe("admin");
  });

  it("admins remove members but not other admins; removed people lose access at once", async () => {
    const owner = await signUp(app, { team: TEAM_A });
    const admin = await signUp(app, { team: TEAM_A });
    const admin2 = await signUp(app, { team: TEAM_A });
    const member = await signUp(app, { team: TEAM_A });
    await owner.agent.patch(`/api/workspaces/current/members/${admin.id}`).send({ role: "admin" }).expect(200);
    await owner.agent.patch(`/api/workspaces/current/members/${admin2.id}`).send({ role: "admin" }).expect(200);

    await admin.agent.delete(`/api/workspaces/current/members/${admin2.id}`).expect(403);
    await admin.agent.delete(`/api/workspaces/current/members/${owner.id}`).expect(403);
    await member.agent.delete(`/api/workspaces/current/members/${admin.id}`).expect(403);

    await admin.agent.delete(`/api/workspaces/current/members/${member.id}`).expect(200);
    await member.agent.get("/api/doc/teamdocs").expect(409); // no workspace left
  });

  it("the owner can't leave without handing over; others can", async () => {
    const owner = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    await owner.agent.post("/api/workspaces/current/leave").expect(400);
    await bob.agent.post("/api/workspaces/current/leave").expect(200);
    expect((await bob.agent.get("/api/me")).body.workspace).toBeNull();
  });

  it("only admins rename the workspace", async () => {
    const owner = await signUp(app, { team: TEAM_A });
    const bob = await signUp(app, { team: TEAM_A });
    await bob.agent.patch("/api/workspaces/current").send({ name: "Mine now" }).expect(403);
    await owner.agent.patch("/api/workspaces/current").send({ name: "Acme Inc" }).expect(200);
    expect((await bob.agent.get("/api/me")).body.workspace.name).toBe("Acme Inc");
  });

  it("teammate list and chats only include the active workspace", async () => {
    const a1 = await signUp(app, { team: TEAM_A });
    await signUp(app, { team: TEAM_A });
    const b1 = await signUp(app, { team: TEAM_B });
    const list = await a1.agent.get("/api/profile/teammembers").expect(200);
    expect(list.body).toHaveLength(1);
    await a1.agent.post("/api/conversations/direct").send({ userIds: [b1.id] }).expect(400);
  });
});
