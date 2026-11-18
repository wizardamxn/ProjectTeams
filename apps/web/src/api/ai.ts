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
