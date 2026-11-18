import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// No real model calls in tests.
vi.mock("../../src/lib/ai.js", () => ({
  generate: vi.fn(async ({ system }: { system: string }) =>
    system.includes("keyword") ? '```json\n["alpha","beta"]\n```' : system.includes("editor") ? "Fixed text." : "Short summary.",
  ),
  embed: vi.fn(async (values: string[]) => values.map(() => [0.1, 0.2])),
}));

const { createApp } = await import("../../src/app.js");
const { clearDb, startDb, stopDb } = await import("../helpers/db.js");
const { signUp } = await import("../helpers/users.js");

const app = createApp();

beforeAll(startDb);
afterEach(clearDb);
afterAll(stopDb);

describe("AI endpoints (logged in)", () => {
  it("summarize", async () => {
    const { agent } = await signUp(app);
    const res = await agent.post("/api/ai/summarize").send({ content: "Some text" }).expect(200);
    expect(res.body.summary).toBe("Short summary.");
  });

  it("generate-tags strips code fences", async () => {
    const { agent } = await signUp(app);
    const res = await agent.post("/api/ai/generate-tags").send({ content: "Some text" }).expect(200);
    expect(res.body.tags).toEqual(["alpha", "beta"]);
  });

  it("improve-writing returns improvedText (the field the editor reads)", async () => {
    const { agent } = await signUp(app);
    const res = await agent.post("/api/ai/improve-writing").send({ content: "bad txt" }).expect(200);
    expect(res.body.improvedText).toBe("Fixed text.");
  });

  it("caps input size", async () => {
    const { agent } = await signUp(app);
    await agent.post("/api/ai/summarize").send({ content: "x".repeat(20_001) }).expect(413);
    await agent.post("/api/ai/ask-docs").send({ question: "x".repeat(1_001) }).expect(413);
  });

  it("requires content", async () => {
    const { agent } = await signUp(app);
    await agent.post("/api/ai/summarize").send({}).expect(400);
  });
});
