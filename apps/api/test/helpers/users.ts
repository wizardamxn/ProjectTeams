import request from "supertest";
import type { Express } from "express";

let counter = 0;

// Labels for "which workspace". The first user signed up with a label creates
// the workspace (and owns it); later users join it through an invite link.
export const TEAM_A = "A";
export const TEAM_B = "B";

export type TestUser = Awaited<ReturnType<typeof registerUser>> & { workspaceId: string };

const owners = new Map<string, TestUser>();

/** Forget workspaces between tests (the database is wiped too). */
export const resetTeams = () => owners.clear();

/** Creates an account with no workspace yet. */
export const registerUser = async (app: Express, name = "Test User") => {
  counter += 1;
  const email = `user${counter}-${Date.now()}@example.com`;
  const password = "password123";
  const agent = request.agent(app);
  await agent.post("/api/auth/register").send({ fullName: `${name} ${counter}`, email, password }).expect(201);
  const { body: profile } = await agent.get("/api/profile/profile").expect(200);
  return { agent, email, password, id: profile._id as string, profile };
};

/** An invite link (token) from `owner`'s active workspace. */
export const createInvite = async (owner: TestUser, body: Record<string, unknown> = {}) => {
  const res = await owner.agent.post("/api/workspaces/current/invites").send(body).expect(201);
  return String(res.body.url).split("/invite/")[1]!;
};

/** A user in workspace `team`: its owner if it's new, otherwise a member who joined by invite. */
export const signUp = async (app: Express, { team = TEAM_A, name = "Test User" } = {}): Promise<TestUser> => {
  const user = await registerUser(app, name);
  const owner = owners.get(team);

  if (!owner) {
    const res = await user.agent.post("/api/workspaces").send({ name: `Workspace ${team}` }).expect(201);
    const created = { ...user, workspaceId: res.body._id as string };
    owners.set(team, created);
    return created;
  }

  const token = await createInvite(owner);
  await user.agent.post(`/api/invites/${token}/accept`).expect(200);
  return { ...user, workspaceId: owner.workspaceId };
};
