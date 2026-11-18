import { PDFParse } from "pdf-parse";

// Only types the worker can actually read. Upload validation uses the same list.
export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
]);

export const extractText = async (buffer: Buffer, mimeType: string): Promise<string> => {
  if (mimeType === "application/pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const { text } = await parser.getText({ pageJoiner: "" });
      return text;
    } finally {
      await parser.destroy();
    }
  }
  if (mimeType.startsWith("text/")) return buffer.toString("utf-8");
  throw new Error(`Unsupported file type: ${mimeType}`);
};

/** Fixed-size character windows with overlap. Phase 5 switches to structure-aware chunking. */
export const chunkText = (text: string, { chunkSize = 1000, overlap = 150 } = {}): string[] => {
  if (overlap >= chunkSize) throw new Error("overlap must be smaller than chunkSize");
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end === text.length) break;
    start = end - overlap;
  }

  return chunks;
};

/** Storage keys must not carry user-controlled path characters. */
export const safeFileName = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^[._]+/, "")
    .slice(-100) || "file";
