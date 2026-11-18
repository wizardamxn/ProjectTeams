import { describe, expect, it } from "vitest";
import { parseTags } from "../../src/modules/ai/ai.service.js";
import { chunkText, safeFileName } from "../../src/modules/knowledge/ingest.js";
import { password } from "../../src/modules/auth/auth.schemas.js";

describe("parseTags", () => {
  it("parses a JSON array", () => {
    expect(parseTags('["React", "API"]')).toEqual(["React", "API"]);
  });
  it("strips markdown code fences", () => {
    expect(parseTags('```json\n["a","b"]\n```')).toEqual(["a", "b"]);
  });
  it("falls back to comma-separated text", () => {
    expect(parseTags("React, Web Dev , API")).toEqual(["React", "Web Dev", "API"]);
  });
});

describe("chunkText", () => {
  it("splits with overlap and covers the whole text", () => {
    const text = "x".repeat(2500);
    const chunks = chunkText(text, { chunkSize: 1000, overlap: 100 });
    expect(chunks.map((c) => c.length)).toEqual([1000, 1000, 700]);
  });
  it("returns nothing for blank text", () => {
    expect(chunkText("   ")).toEqual([]);
  });
  it("rejects overlap >= chunk size (would loop forever)", () => {
    expect(() => chunkText("abc", { chunkSize: 10, overlap: 10 })).toThrow();
  });
});

describe("safeFileName", () => {
  it("removes path traversal and odd characters", () => {
    expect(safeFileName("../../etc/passwd")).toBe("etc_passwd");
    expect(safeFileName("my report (final).pdf")).toBe("my_report_final_.pdf");
  });
  it("never returns an empty name", () => {
    expect(safeFileName("...")).toBe("file");
  });
});

describe("password rule", () => {
  it.each([
    ["password123", true],
    ["short1", false],
    ["allletters", false],
    ["12345678", false],
  ])("%s -> %s", (value, ok) => {
    expect(password.safeParse(value).success).toBe(ok);
  });
});
