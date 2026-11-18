import request from "supertest";
import type { Express } from "express";

let counter = 0;

export const TEAM_A = "11111111";
export const TEAM_B = "22222222";

/** Registers a user through the API and returns an agent that carries their session cookie. */
export const signUp = async (app: Express, { teamCode = TEAM_A, name = "Test User" } = {}) => {
  counter += 1;
  const email = `user${counter}-${Date.now()}@example.com`;
  const password = "password123";
  const agent = request.agent(app);
  await agent
    .post("/api/auth/register")
    .send({ fullName: `${name} ${counter}`, email, password, teamCode })
    .expect(201);
  const { body: profile } = await agent.get("/api/profile/profile").expect(200);
  return { agent, email, password, id: profile._id as string, profile };
};
