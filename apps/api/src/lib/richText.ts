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
