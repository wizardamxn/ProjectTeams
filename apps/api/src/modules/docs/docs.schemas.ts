import { z } from "zod";
import { isReasonableRichText } from "../../lib/richText.js";

export const TITLE_MAX = 200;
/** Plain-text docs (older clients) are still accepted. */
export const CONTENT_MAX = 200_000;

const tags = z
  .array(z.string())
  .transform((list) => [...new Set(list.map((t) => t.trim()).filter(Boolean))].slice(0, 20));

const richText = z
  .record(z.unknown())
  .refine((v) => isReasonableRichText(v), "Document is too large or not valid editor content");

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");

// Only these fields can ever come from the client. Ownership fields
// (teamId, createdBy, author, versions, starredBy) are always set by the server.
export const createDocSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(TITLE_MAX, "Title is too long"),
  contentJson: richText.optional(),
  /** Legacy plain text; ignored when contentJson is sent. */
  content: z.string().max(CONTENT_MAX, "Content is too long").optional(),
  summary: z.string().max(2000).optional(),
  tags: tags.optional(),
  folderId: objectId.nullable().optional(),
  starred: z.boolean().optional(),
});

export const updateDocSchema = createDocSchema.omit({ starred: true }).partial();

export const folderSchema = z.object({
  name: z.string({ required_error: "Name is required" }).trim().min(1, "Name is required").max(60, "Name is too long"),
});

export type CreateDocInput = z.infer<typeof createDocSchema>;
export type UpdateDocInput = z.infer<typeof updateDocSchema>;
