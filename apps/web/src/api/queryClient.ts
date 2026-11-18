import { QueryClient } from "@tanstack/react-query";
import axios from "axios";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      // Don't retry client errors (401/403/404); they won't fix themselves.
      retry: (failureCount, error) => {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

/** Every query key in one place, so invalidation can't drift from the queries. */
export const keys = {
  docs: {
    all: ["docs"] as const,
    team: () => [...keys.docs.all, "team"] as const,
    starred: () => [...keys.docs.all, "starred"] as const,
    mine: () => [...keys.docs.all, "mine"] as const,
    detail: (id: string) => [...keys.docs.all, "detail", id] as const,
  },
  team: { members: ["team", "members"] as const },
  workspace: {
    members: ["workspace", "members"] as const,
    invites: ["workspace", "invites"] as const,
    invite: (token: string) => ["invite", token] as const,
  },
  chat: {
    conversations: ["chat", "conversations"] as const,
    browse: ["chat", "browse"] as const,
    members: (conversationId: string) => ["chat", "members", conversationId] as const,
    messages: (conversationId: string) => ["chat", "messages", conversationId] as const,
    thread: (conversationId: string, rootId: string) => ["chat", "thread", conversationId, rootId] as const,
    typing: (conversationId: string) => ["chat", "typing", conversationId] as const,
    presence: ["chat", "presence"] as const,
  },
  notifications: ["notifications"] as const,
  knowledge: {
    all: ["knowledge"] as const,
    list: () => [...keys.knowledge.all, "list"] as const,
    detail: (id: string) => [...keys.knowledge.all, "detail", id] as const,
  },
};
