import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Object storage and the queue are external services; replace them.
const { files, enqueued } = vi.hoisted(() => ({ files: new Map<string, Buffer>(), enqueued: [] as unknown[] }));
vi.mock("../../src/lib/storage.js", () => ({
  storage: {
    upload: vi.fn(async (path: string, data: Buffer) => void files.set(path, data)),
    download: vi.fn(async (path: string) => files.get(path)!),
    remove: vi.fn(async (path: string) => void files.delete(path)),
    signedUrls: vi.fn(async (paths: string[]) => paths.map((p) => `https://signed.example/${p}?sig=1`)),
  },
}));
vi.mock("../../src/queues/ragQueue.js", () => ({
  enqueueIngest: vi.fn(async (job: unknown) => void enqueued.push(job)),
  enqueueDocIndex: vi.fn(async () => null),
  enqueueChatIndex: vi.fn(async () => null),
}));

const { createApp } = await import("../../src/app.js");
const { clearDb, startDb, stopDb } = await import("../helpers/db.js");
const { signUp, TEAM_A, TEAM_B } = await import("../helpers/users.js");

const app = createApp();

beforeAll(startDb);
afterEach(async () => {
  files.clear();
  enqueued.length = 0;
  await clearDb();
});
afterAll(stopDb);

describe("knowledge uploads", () => {
  it("uploads a text file, sanitises the key, and returns a signed URL", async () => {
    const { agent, workspaceId } = await signUp(app, { team: TEAM_A });
    const res = await agent
      .post("/api/upload/document")
      .attach("document", Buffer.from("hello world"), { filename: "../../notes (v1).txt", contentType: "text/plain" })
      .expect(201);

    const doc = res.body.document;
    expect(doc.storagePath).toMatch(new RegExp(`^${workspaceId}/\\d+-notes_v1_.txt$`));
    expect(doc.fileUrl).toMatch(/^https:\/\/signed\.example\//);
    expect(doc.ragStatus).toBe("processing"); // indexing starts on upload
  });

  it("rejects file types the indexer can't read", async () => {
    const { agent } = await signUp(app);
    await agent
      .post("/api/upload/document")
      .attach("document", Buffer.from("MZ"), { filename: "virus.exe", contentType: "application/octet-stream" })
      .expect(415);
  });

  it("other teams can't see, index or delete the file", async () => {
    const alice = await signUp(app, { team: TEAM_A });
    const mallory = await signUp(app, { team: TEAM_B });
    const up = await alice.agent
      .post("/api/upload/document")
      .attach("document", Buffer.from("secret"), { filename: "s.txt", contentType: "text/plain" })
      .expect(201);
    const id = up.body.document._id;

    await mallory.agent.get(`/api/upload/document/${id}`).expect(404);
    await mallory.agent.post(`/api/upload/document/${id}/ragify`).expect(404);
    await mallory.agent.delete(`/api/upload/document/${id}`).expect(404);
    expect((await mallory.agent.get("/api/upload/documents").expect(200)).body).toHaveLength(0);
  });

  it("queues indexing on upload, once", async () => {
    const { agent } = await signUp(app);
    const up = await agent
      .post("/api/upload/document")
      .attach("document", Buffer.from("text"), { filename: "a.md", contentType: "text/markdown" })
      .expect(201);
    const id = up.body.document._id;

    expect(enqueued).toHaveLength(1);
    await agent.post(`/api/upload/document/${id}/ragify`).expect(409); // already processing
    expect(enqueued).toHaveLength(1);
  });

  it("delete removes the stored file", async () => {
    const { agent } = await signUp(app);
    const up = await agent
      .post("/api/upload/document")
      .attach("document", Buffer.from("text"), { filename: "a.txt", contentType: "text/plain" })
      .expect(201);
    await agent.delete(`/api/upload/document/${up.body.document._id}`).expect(200);
    expect(files.size).toBe(0);
  });
});
