import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { keys } from "./queryClient";
import type { AskAnswer, RagChunk, RagDoc } from "./types";

// "Knowledge" = uploaded files the team can ask questions about (API path: /upload).

const POLL_WHILE_PROCESSING_MS = 3000;

export const useKnowledgeDocs = () =>
  useQuery({
    queryKey: keys.knowledge.list(),
    queryFn: () => api.get<RagDoc[]>("/upload/documents").then((r) => r.data),
    // Keep polling only while something is being indexed.
    refetchInterval: (query) =>
      query.state.data?.some((d) => d.ragStatus === "processing") ? POLL_WHILE_PROCESSING_MS : false,
  });

export const useKnowledgeDoc = (id: string | undefined) =>
  useQuery({
    queryKey: keys.knowledge.detail(id ?? ""),
    queryFn: () =>
      api.get<{ document: RagDoc; chunks: RagChunk[] }>(`/upload/document/${id}`).then((r) => r.data),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      query.state.data?.document.ragStatus === "processing" ? POLL_WHILE_PROCESSING_MS : false,
  });

export const useUploadKnowledgeDoc = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("document", file);
      return api.post<{ document: RagDoc }>("/upload/document", form).then((r) => r.data.document);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.knowledge.all }),
  });
};

export const useIndexKnowledgeDoc = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/upload/document/${id}/ragify`).then(() => id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.knowledge.all }),
  });
};

export const useDeleteKnowledgeDoc = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/upload/document/${id}`).then(() => id),
    onSuccess: (id) => {
      qc.removeQueries({ queryKey: keys.knowledge.detail(id) });
      return qc.invalidateQueries({ queryKey: keys.knowledge.list() });
    },
  });
};

export const useAskDocs = () =>
  useMutation({
    mutationFn: (question: string) => api.post<AskAnswer>("/ai/ask-docs", { question }).then((r) => r.data),
  });
