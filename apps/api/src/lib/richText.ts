// Helpers for the editor's document format (Tiptap / ProseMirror JSON).
// The server never trusts client-sent plain text: it derives it from the JSON.

export interface RichNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: RichNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

const BLOCKS = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "codeBlock",
  "listItem",
  "taskItem",
  "horizontalRule",
]);

/** Plain text with a line break after every block (for search, AI and indexing). */
export const richTextToPlain = (doc: unknown): string => {
  const out: string[] = [];
  const walk = (node: RichNode, prefix = "") => {
    if (!node || typeof node !== "object") return;
    if (node.type === "text" && typeof node.text === "string") {
      out.push(node.text);
      return;
    }
    if (node.type === "hardBreak") {
      out.push("\n");
      return;
    }
    if (node.type === "listItem") out.push(`${prefix}- `);
    if (node.type === "taskItem") out.push(`${prefix}[${node.attrs?.checked ? "x" : " "}] `);
    for (const child of node.content ?? []) walk(child, node.type === "listItem" || node.type === "taskItem" ? `${prefix}  ` : prefix);
    // One line break per block, even when blocks nest (a list item holds a paragraph).
    if (BLOCKS.has(node.type) && !(out.at(-1) ?? "").endsWith("\n")) out.push("\n");
  };
  walk(doc as RichNode);
  return out
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const paragraph = (text: string): RichNode =>
  text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" };

/** Plain text (pre-Phase-5 docs) as editor JSON: one paragraph per line. */
export const plainToRichText = (text: string): RichNode => ({
  type: "doc",
  content: (text || "").split("\n").map(paragraph),
});

export interface DraftBlock {
  type: "heading" | "paragraph" | "bullets" | "tasks";
  text?: string;
  items?: string[];
}

/** AI-written blocks as editor JSON. */
export const blocksToRichText = (blocks: DraftBlock[]): RichNode => ({
  type: "doc",
  content: blocks.flatMap((b): RichNode[] => {
    if (b.type === "heading" && b.text) return [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: b.text }] }];
    if (b.type === "paragraph" && b.text) return [paragraph(b.text)];
    if ((b.type === "bullets" || b.type === "tasks") && b.items?.length) {
      const item = b.type === "tasks" ? "taskItem" : "listItem";
      return [
        {
          type: b.type === "tasks" ? "taskList" : "bulletList",
          content: b.items.filter(Boolean).map((t) => ({
            type: item,
            ...(b.type === "tasks" ? { attrs: { checked: false } } : {}),
            content: [paragraph(t)],
          })),
        },
      ];
    }
    return [];
  }),
});

/** Rough guard against huge or deeply nested payloads before we store them. */
export const isReasonableRichText = (doc: unknown, maxBytes = 500_000): boolean => {
  if (!doc || typeof doc !== "object" || (doc as RichNode).type !== "doc") return false;
  try {
    return JSON.stringify(doc).length <= maxBytes;
  } catch {
    return false;
  }
};

/* ---------------- Markdown (exports) ---------------- */

const escapeMd = (s: string) => s.replace(/([\\`*_[\]#<>|])/g, "\\$1");

const inlineMd = (nodes: RichNode[] = []): string =>
  nodes
    .map((n) => {
      if (n.type === "hardBreak") return "  \n";
      if (n.type !== "text" || typeof n.text !== "string") return inlineMd(n.content);
      const marks = new Set((n.marks ?? []).map((m) => m.type));
      // Code spans are literal; everything else is escaped.
      let t = marks.has("code") ? `\`${n.text.replace(/`/g, "\u02cb")}\`` : escapeMd(n.text);
      if (marks.has("bold")) t = `**${t}**`;
      if (marks.has("italic")) t = `*${t}*`;
      if (marks.has("strike")) t = `~~${t}~~`;
      const link = n.marks?.find((m) => m.type === "link");
      const href = typeof link?.attrs?.href === "string" ? link.attrs.href : null;
      if (href && /^(https?:|mailto:)/i.test(href)) t = `[${t}](${href.replace(/\)/g, "%29")})`;
      return t;
    })
    .join("");

const indent = (text: string, pad: string) =>
  text
    .split("\n")
    .map((l, i) => (i === 0 || !l ? l : pad + l))
    .join("\n");

const blockMd = (node: RichNode): string => {
  const kids = node.content ?? [];
  switch (node.type) {
    case "doc":
      return kids.map(blockMd).filter((b) => b !== "").join("\n\n");
    case "paragraph":
      return inlineMd(kids);
    case "heading": {
      const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 6);
      return `${"#".repeat(level)} ${inlineMd(kids)}`;
    }
    case "blockquote":
      return kids
        .map(blockMd)
        .join("\n\n")
        .split("\n")
        .map((l) => (l ? `> ${l}` : ">"))
        .join("\n");
    case "codeBlock": {
      const lang = typeof node.attrs?.language === "string" ? node.attrs.language : "";
      const code = kids.map((k) => k.text ?? "").join("");
      const fence = code.includes("```") ? "````" : "```";
      return `${fence}${lang}\n${code}\n${fence}`;
    }
    case "horizontalRule":
      return "---";
    case "bulletList":
      return kids.map((li) => `- ${indent(listItemMd(li), "  ")}`).join("\n");
    case "orderedList": {
      const start = Number(node.attrs?.start) || 1;
      return kids.map((li, i) => `${start + i}. ${indent(listItemMd(li), "   ")}`).join("\n");
    }
    case "taskList":
      return kids.map((li) => `- [${li.attrs?.checked ? "x" : " "}] ${indent(listItemMd(li), "  ")}`).join("\n");
    default:
      // Unknown blocks: keep their text rather than dropping it.
      return kids.length ? kids.map(blockMd).join("\n\n") : inlineMd([node]);
  }
};

/** A list item's blocks, with nested lists kept tight under the first line. */
const listItemMd = (li: RichNode) =>
  (li.content ?? [])
    .map(blockMd)
    .filter((b) => b !== "")
    .join("\n");

/** Editor JSON as GitHub-flavoured Markdown. */
export const richTextToMarkdown = (doc: unknown): string => {
  if (!doc || typeof doc !== "object") return "";
  return blockMd(doc as RichNode).replace(/\n{3,}/g, "\n\n").trim() + "\n";
};
