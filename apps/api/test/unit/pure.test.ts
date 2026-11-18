import { describe, expect, it } from "vitest";
import { richTextToMarkdown } from "../../src/lib/richText.js";
import { csvCell } from "../../src/modules/audit/audit.service.js";
import { safeName } from "../../src/modules/export/zip.js";
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

import { channelName } from "../../src/modules/chat/conversations.service.js";

describe("channelName", () => {
  it.each([
    ["Design Team!", "design-team"],
    ["  --hello__world--  ", "hello-world"],
    ["Ünïcode & stuff", "unicode-stuff"],
    ["!!!", ""],
  ])("%s -> %s", (raw, expected) => {
    expect(channelName(raw)).toBe(expected);
  });
});

import { blocksToRichText, plainToRichText, richTextToPlain, isReasonableRichText } from "../../src/lib/richText.js";
import { parseDraft } from "../../src/modules/ai/ai.service.js";
import { snippet } from "../../src/modules/search/search.service.js";
import { toSource } from "../../src/modules/knowledge/knowledge.service.js";
import { Types } from "mongoose";

describe("rich text", () => {
  const doc = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Launch" }] },
      { type: "paragraph", content: [{ type: "text", text: "Ship on " }, { type: "text", text: "Friday", marks: [{ type: "bold" }] }] },
      {
        type: "bulletList",
        content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Docs" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Blog" }] }] },
        ],
      },
      {
        type: "taskList",
        content: [{ type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "QA" }] }] }],
      },
    ],
  };

  it("derives plain text the way people read it", () => {
    expect(richTextToPlain(doc)).toBe("Launch\nShip on Friday\n- Docs\n- Blog\n[x] QA");
  });
  it("turns old plain-text docs into paragraphs", () => {
    expect(richTextToPlain(plainToRichText("one\ntwo"))).toBe("one\ntwo");
  });
  it("builds docs from AI blocks", () => {
    const rich = blocksToRichText([
      { type: "heading", text: "Summary" },
      { type: "bullets", items: ["a", "b"] },
      { type: "tasks", items: ["Ship it"] },
      { type: "paragraph" }, // empty: dropped
    ]);
    expect(richTextToPlain(rich)).toBe("Summary\n- a\n- b\n[ ] Ship it");
  });
  it("rejects things that aren't editor documents", () => {
    expect(isReasonableRichText({ type: "paragraph" })).toBe(false);
    expect(isReasonableRichText({ type: "doc", content: [] })).toBe(true);
    expect(isReasonableRichText({ type: "doc", big: "x".repeat(600_000) })).toBe(false);
  });
});

describe("parseDraft", () => {
  it("reads fenced JSON", () => {
    const d = parseDraft('```json\n{"title":"Plan","blocks":[{"type":"paragraph","text":"Hi"}]}\n```', "x");
    expect(d).toEqual({ title: "Plan", blocks: [{ type: "paragraph", text: "Hi" }] });
  });
  it("falls back to paragraphs when the model ignores the format", () => {
    expect(parseDraft("First.\n\nSecond.", "Notes")).toEqual({
      title: "Notes",
      blocks: [
        { type: "paragraph", text: "First." },
        { type: "paragraph", text: "Second." },
      ],
    });
  });
});

describe("search snippet", () => {
  it("centres on the first matching word", () => {
    const text = `${"a ".repeat(100)}the launch date is Friday ${"b ".repeat(100)}`;
    const s = snippet(text, "launch");
    expect(s.startsWith("…")).toBe(true);
    expect(s).toContain("launch date is Friday");
  });
});

describe("Ask citations", () => {
  const id = new Types.ObjectId();
  it("links each source type to the right place", () => {
    expect(toSource({ _id: id, text: "t", score: 1, sourceType: "doc", sourceId: id, title: "Plan" }, 1)).toMatchObject({
      type: "doc", docId: id.toString(), fileId: null, conversationId: null,
    });
    expect(toSource({ _id: id, text: "t", score: 1, documentId: id }, 2)).toMatchObject({ type: "file", fileId: id.toString() });
    const msg = new Types.ObjectId();
    expect(toSource({ _id: id, text: "t", score: 1, sourceType: "chat", sourceId: id, messageId: msg, title: "#general" }, 3)).toMatchObject({
      type: "chat", conversationId: id.toString(), messageId: msg.toString(), title: "#general",
    });
  });
});

describe("richTextToMarkdown", () => {
  const t = (text: string, ...marks: string[]) => ({ type: "text", text, marks: marks.map((type) => ({ type })) });
  const p = (...content: unknown[]) => ({ type: "paragraph", content });
  const li = (...content: unknown[]) => ({ type: "listItem", content });

  it("converts headings, marks, links and code", () => {
    const md = richTextToMarkdown({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [t("Plan")] },
        p(t("Ship "), t("now", "bold"), t(" or "), t("never", "italic"), t(" via "), t("x()", "code")),
        p({ type: "text", text: "docs", marks: [{ type: "link", attrs: { href: "https://example.com/a(b)" } }] }),
        { type: "codeBlock", attrs: { language: "ts" }, content: [t("const a = 1;")] },
        { type: "horizontalRule" },
        { type: "blockquote", content: [p(t("quoted"))] },
      ],
    });
    expect(md).toBe(
      "## Plan\n\nShip **now** or *never* via `x()`\n\n[docs](https://example.com/a(b%29)\n\n```ts\nconst a = 1;\n```\n\n---\n\n> quoted\n",
    );
  });

  it("converts nested lists and checklists", () => {
    const md = richTextToMarkdown({
      type: "doc",
      content: [
        { type: "bulletList", content: [li(p(t("a")), { type: "bulletList", content: [li(p(t("a1")))] }), li(p(t("b")))] },
        { type: "orderedList", attrs: { start: 3 }, content: [li(p(t("three"))), li(p(t("four")))] },
        { type: "taskList", content: [{ type: "taskItem", attrs: { checked: true }, content: [p(t("done"))] }, { type: "taskItem", attrs: { checked: false }, content: [p(t("todo"))] }] },
      ],
    });
    expect(md).toBe("- a\n  - a1\n- b\n\n3. three\n4. four\n\n- [x] done\n- [ ] todo\n");
  });

  it("escapes Markdown characters and drops unsafe links", () => {
    const md = richTextToMarkdown({
      type: "doc",
      content: [p(t("# not a heading *x*")), p({ type: "text", text: "bad", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] })],
    });
    expect(md).toBe("\\# not a heading \\*x\\*\n\nbad\n");
  });

  it("handles junk", () => {
    expect(richTextToMarkdown(null)).toBe("");
    expect(richTextToMarkdown({ type: "doc" })).toBe("\n");
  });
});

describe("export helpers", () => {

  it("csvCell quotes and defuses formulas", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell(null)).toBe("");
    expect(csvCell(new Date("2026-01-02T03:04:05Z"))).toBe("2026-01-02T03:04:05.000Z");
  });

  it("safeName makes file names safe", () => {
    expect(safeName("Q4 plan / draft")).toBe("Q4 plan - draft");
    expect(safeName("../../etc/passwd")).toBe("etc - passwd");
    expect(safeName("   ")).toBe("untitled");
    expect(safeName("a".repeat(200))).toHaveLength(80);
  });
});
