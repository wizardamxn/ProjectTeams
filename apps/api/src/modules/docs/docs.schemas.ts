import { z } from "zod";

export const TITLE_MAX = 100;
export const CONTENT_MAX = 100_000;

const tags = z
  .array(z.string())
  .transform((list) => [...new Set(list.map((t) => t.trim()).filter(Boolean))].slice(0, 20));

// Only these fields can ever come from the client. Ownership fields
// (teamId, createdBy, author, versions) are always set by the server.
export const createDocSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(TITLE_MAX, "Title is too long"),
  content: z.string().min(1, "Content is required").max(CONTENT_MAX, "Content is too long"),
  summary: z.string().max(2000).optional(),
  tags: tags.optional(),
  starred: z.boolean().optional(),
});

export const updateDocSchema = createDocSchema.omit({ starred: true }).partial();

export type CreateDocInput = z.infer<typeof createDocSchema>;
export type UpdateDocInput = z.infer<typeof updateDocSchema>;
