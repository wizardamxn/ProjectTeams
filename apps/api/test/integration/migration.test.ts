import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import { createApp } from "../../src/app.js";
import { Chat } from "../../src/models/chat.js";
import { Document } from "../../src/models/document.js";
import { Membership } from "../../src/models/membership.js";
import { RagChunk } from "../../src/models/ragChunk.js";
import { User } from "../../src/models/user.js";
import { Workspace } from "../../src/models/workspace.js";
import { migrateAllLegacyTeams } from "../../src/modules/workspaces/legacyMigration.js";
import { clearDb, startDb, stopDb } from "../helpers/db.js";

const app = createApp();

beforeAll(startDb);
afterEach(clearDb);
afterAll(stopDb);

/** Users and data exactly as Phase 1/2 stored them: a shared teamCode, no workspace. */
const seedLegacyTeam = async (teamCode: string) => {
  const password = await bcrypt.hash("password123", 4);
  const first = await User.create({ fullName: "First User", email: `first-${teamCode}@ex.com`, password, teamCode });
  await new Promise((r) => setTimeout(r, 5)); // distinct createdAt
  const second = await User.create({ fullName: "Second User", email: `second-${teamCode}@ex.com`, password, teamCode });
  await Document.create({ title: "Old doc", content: "x", createdBy: first._id, teamId: teamCode, author: { name: "First" } });
  await RagChunk.create({ documentId: first._id, teamId: teamCode, chunkIndex: 0, text: "t", embedding: [0.1] });
  await Chat.create({ participants: [first._id, second._id], messages: [] });
  return { first, second };
};

const loginAs = async (email: string) => {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email, password: "password123" }).expect(200);
  return agent;
};

describe("legacy team codes", () => {
  it("are migrated the first time a member uses the app", async () => {
    const { first, second } = await seedLegacyTeam("12345678");

    const agent = await loginAs(second.email);
    const me = await agent.get("/api/me").expect(200);
    expect(me.body.workspace.name).toBe("Team 12345678");
    expect(me.body.role).toBe("member");

    const ws = await Workspace.findOne({ legacyTeamCode: "12345678" });
    const key = ws!._id.toString();
    expect(await Membership.findOne({ userId: first._id }).then((m) => m?.role)).toBe("owner");
    expect(await Document.countDocuments({ teamId: key })).toBe(1);
    expect(await RagChunk.countDocuments({ teamId: key })).toBe(1);
    expect(await Chat.countDocuments({ workspaceId: ws!._id })).toBe(1);

    // Old docs are visible in the new workspace.
    expect((await agent.get("/api/doc/teamdocs").expect(200)).body).toHaveLength(1);
  });

  it("running it again changes nothing", async () => {
    await seedLegacyTeam("11112222");
    await migrateAllLegacyTeams();
    await migrateAllLegacyTeams();
    expect(await Workspace.countDocuments()).toBe(1);
    expect(await Membership.countDocuments()).toBe(2);
  });

  it("keeps separate teams separate", async () => {
    await seedLegacyTeam("11111111");
    const { second } = await seedLegacyTeam("22222222");
    expect(await migrateAllLegacyTeams()).toBe(2);
    const agent = await loginAs(second.email);
    const docs = (await agent.get("/api/doc/teamdocs").expect(200)).body as { teamId: string }[];
    expect(docs).toHaveLength(1);
    const ws = await Workspace.findOne({ legacyTeamCode: "22222222" });
    expect(docs[0]!.teamId).toBe(ws!._id.toString());
  });
});
