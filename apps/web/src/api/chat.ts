import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { keys } from "./queryClient";
import type {
  AppNotification,
  BrowseChannel,
  Conversation,
  Message,
  MessagePage,
  Person,
  Thread,
  UploadedAttachment,
} from "./types";

/* ================= Cache helpers (shared with the realtime hook) ================= */

type Pages = InfiniteData<MessagePage, string | undefined>;

/** Adds or replaces a message in a conversation's timeline cache. */
export const upsertTimelineMessage = (qc: QueryClient, message: Message) => {
  qc.setQueryData<Pages>(keys.chat.messages(message.conversationId), (data) => {
    if (!data) return data;
    const exists = data.pages.some((p) => p.messages.some((m) => m._id === message._id));
    if (exists) {
      return {
        ...data,
        pages: data.pages.map((p) => ({ ...p, messages: p.messages.map((m) => (m._id === message._id ? message : m)) })),
      };
    }
    // New message: append to the newest page (pages[0]).
    const [newest, ...rest] = data.pages;
    if (!newest) return data;
    return { ...data, pages: [{ ...newest, messages: [...newest.messages, message] }, ...rest] };
  });
};

/** Adds or replaces a reply (or the root) in an open thread's cache. */
export const upsertThreadMessage = (qc: QueryClient, message: Message) => {
  const rootId = message.threadRootId ?? message._id;
  qc.setQueryData<Thread>(keys.chat.thread(message.conversationId, rootId), (data) => {
    if (!data) return data;
    if (!message.threadRootId) return { ...data, root: message };
    const exists = data.replies.some((r) => r._id === message._id);
    return {
      ...data,
      replies: exists ? data.replies.map((r) => (r._id === message._id ? message : r)) : [...data.replies, message],
    };
  });
};

export const patchConversation = (qc: QueryClient, id: string, patch: (c: Conversation) => Conversation) => {
  qc.setQueryData<Conversation[]>(keys.chat.conversations, (list) => list?.map((c) => (c._id === id ? patch(c) : c)));
};

/* ================= Conversations ================= */

export const useConversations = () =>
  useQuery({
    queryKey: keys.chat.conversations,
    queryFn: () => api.get<Conversation[]>("/conversations").then((r) => r.data),
  });

export const useBrowseChannels = ({ enabled = true } = {}) =>
  useQuery({
    queryKey: keys.chat.browse,
    queryFn: () => api.get<BrowseChannel[]>("/conversations/browse").then((r) => r.data),
    enabled,
  });

export const useConversationMembers = (id: string | undefined) =>
  useQuery({
    queryKey: keys.chat.members(id ?? ""),
    queryFn: () => api.get<(Person & { email: string })[]>(`/conversations/${id}/members`).then((r) => r.data),
    enabled: Boolean(id),
  });

const useInvalidateConversations = () => {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: keys.chat.conversations });
    qc.invalidateQueries({ queryKey: keys.chat.browse });
  };
};

export const useCreateChannel = () => {
  const invalidate = useInvalidateConversations();
  return useMutation({
    mutationFn: (input: { name: string; topic?: string; isPrivate?: boolean; memberIds?: string[] }) =>
      api.post<{ _id: string; name: string }>("/conversations/channels", input).then((r) => r.data),
    onSuccess: invalidate,
  });
};

export const useOpenDirect = () => {
  const invalidate = useInvalidateConversations();
  return useMutation({
    mutationFn: (userIds: string[]) =>
      api.post<{ _id: string }>("/conversations/direct", { userIds }).then((r) => r.data),
    onSuccess: invalidate,
  });
};

export const useJoinChannel = () => {
  const invalidate = useInvalidateConversations();
  return useMutation({
    mutationFn: (id: string) => api.post(`/conversations/${id}/join`).then(() => id),
    onSuccess: invalidate,
  });
};

export const useLeaveConversation = () => {
  const invalidate = useInvalidateConversations();
  return useMutation({
    mutationFn: (id: string) => api.post(`/conversations/${id}/leave`),
    onSuccess: invalidate,
  });
};

export const useUpdateConversation = () => {
  const invalidate = useInvalidateConversations();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; name?: string; topic?: string }) =>
      api.patch(`/conversations/${id}`, input),
    onSuccess: invalidate,
  });
};

export const useAddMembers = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userIds }: { id: string; userIds: string[] }) =>
      api.post<{ added: string[] }>(`/conversations/${id}/members`, { userIds }).then((r) => r.data),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: keys.chat.members(id) });
      qc.invalidateQueries({ queryKey: keys.chat.conversations });
    },
  });
};

/** Marks a conversation read on the server and clears its badge right away. */
export const useMarkRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/conversations/${id}/read`),
    onMutate: (id) => patchConversation(qc, id, (c) => ({ ...c, unreadCount: 0, mentionCount: 0 })),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notifications }),
  });
};

/* ================= Messages ================= */

export const useMessages = (conversationId: string | undefined) =>
  useInfiniteQuery({
    queryKey: keys.chat.messages(conversationId ?? ""),
    queryFn: ({ pageParam }) =>
      api
        .get<MessagePage>(`/conversations/${conversationId}/messages`, { params: { before: pageParam, limit: 50 } })
        .then((r) => r.data),
    initialPageParam: undefined as string | undefined,
    // Older pages: everything before the oldest message we have.
    getNextPageParam: (last) => (last.hasMore ? last.messages[0]?._id : undefined),
    enabled: Boolean(conversationId),
    staleTime: Infinity, // kept fresh by the socket; refetched on reconnect
  });

export const useThread = (conversationId: string | undefined, rootId: string | null) =>
  useQuery({
    queryKey: keys.chat.thread(conversationId ?? "", rootId ?? ""),
    queryFn: () => api.get<Thread>(`/conversations/${conversationId}/threads/${rootId}`).then((r) => r.data),
    enabled: Boolean(conversationId && rootId),
    staleTime: Infinity,
  });

export const uploadAttachment = (conversationId: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api.post<UploadedAttachment>(`/conversations/${conversationId}/attachments`, form).then((r) => r.data);
};

export const useSendMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      conversationId,
      ...body
    }: {
      conversationId: string;
      text: string;
      threadRootId?: string;
      mentions?: string[];
      attachments?: UploadedAttachment[];
    }) => api.post<Message>(`/conversations/${conversationId}/messages`, body).then((r) => r.data),
    // The socket usually delivers it first; this covers a dropped connection.
    onSuccess: (message) => {
      if (message.threadRootId) upsertThreadMessage(qc, message);
      else upsertTimelineMessage(qc, message);
    },
  });
};

export const useEditMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => api.patch<Message>(`/messages/${id}`, { text }).then((r) => r.data),
    onSuccess: (message) => {
      upsertTimelineMessage(qc, message);
      upsertThreadMessage(qc, message);
    },
  });
};

export const useDeleteMessage = () =>
  useMutation({ mutationFn: (id: string) => api.delete(`/messages/${id}`) });

/* ================= Notifications ================= */

export const useNotifications = () =>
  useQuery({
    queryKey: keys.notifications,
    queryFn: () => api.get<{ unread: number; items: AppNotification[] }>("/notifications").then((r) => r.data),
  });

export const useMarkNotificationsRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => api.post("/notifications/read", { ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.notifications });
      qc.invalidateQueries({ queryKey: keys.chat.conversations });
    },
  });
};

/* ================= Presence & typing (filled by the realtime hook) ================= */

export const usePresence = () =>
  useQuery({
    queryKey: keys.chat.presence,
    queryFn: () => new Set<string>(),
    staleTime: Infinity,
    initialData: new Set<string>(),
  }).data;

export interface Typist {
  userId: string;
  fullName: string;
  until: number;
}

export const useTyping = (conversationId: string) =>
  useQuery({
    queryKey: keys.chat.typing(conversationId),
    queryFn: () => [] as Typist[],
    staleTime: Infinity,
    initialData: [] as Typist[],
  }).data;
