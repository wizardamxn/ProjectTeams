import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const useSummarize = () =>
  useMutation({
    mutationFn: (content: string) =>
      api.post<{ summary: string }>("/ai/summarize", { content }).then((r) => r.data.summary),
  });

export const useGenerateTags = () =>
  useMutation({
    mutationFn: (content: string) =>
      api.post<{ tags: string[] }>("/ai/generate-tags", { content }).then((r) => r.data.tags),
  });

export const useImproveWriting = () =>
  useMutation({
    mutationFn: (content: string) =>
      api.post<{ improvedText: string }>("/ai/improve-writing", { content }).then((r) => r.data.improvedText),
  });

/** "What did I miss?" for one conversation (last 24 hours unless `since` is given). */
export const useCatchUp = () =>
  useMutation({
    mutationFn: (input: { conversationId: string; since?: string }) =>
      api.post<{ summary: string | null; count: number; since: string }>("/ai/catch-up", input).then((r) => r.data),
  });

/** Turns a chat thread into a new doc. */
export const useThreadToDoc = () =>
  useMutation({
    mutationFn: (input: { conversationId: string; rootId: string }) =>
      api.post<{ _id: string; title: string }>("/ai/thread-to-doc", input).then((r) => r.data),
  });
