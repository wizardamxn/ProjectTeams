import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppDispatch } from "@/store/hooks";
import { checkAuth } from "@/store/slices/User";
import { keys } from "./queryClient";
import type { AuditFilter, AuditPage, Invite, InvitePreview, Member, Role, Webhook, WebhookDelivery, WebhookInput } from "./types";

/**
 * Anything that changes which workspace you're in, or your role in it,
 * reloads the session and drops every cached query (they belong to the old workspace).
 */
export const useRefreshSession = () => {
  const dispatch = useAppDispatch();
  const qc = useQueryClient();
  return async () => {
    qc.clear();
    await dispatch(checkAuth()).unwrap();
  };
};

export const useCreateWorkspace = () => {
  const refresh = useRefreshSession();
  return useMutation({
    mutationFn: (name: string) => api.post("/workspaces", { name }),
    onSuccess: refresh,
  });
};

export const useSwitchWorkspace = () => {
  const refresh = useRefreshSession();
  return useMutation({
    mutationFn: (workspaceId: string) => api.post(`/workspaces/${workspaceId}/switch`),
    onSuccess: refresh,
  });
};

export const useRenameWorkspace = () => {
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: (name: string) => api.patch("/workspaces/current", { name }),
    onSuccess: () => dispatch(checkAuth()),
  });
};

export const useLeaveWorkspace = () => {
  const refresh = useRefreshSession();
  return useMutation({
    mutationFn: () => api.post("/workspaces/current/leave"),
    onSuccess: refresh,
  });
};

/* ---- Members ---- */

export const useMembers = () =>
  useQuery({
    queryKey: keys.workspace.members,
    queryFn: () => api.get<Member[]>("/workspaces/current/members").then((r) => r.data),
  });

export const useChangeRole = () => {
  const qc = useQueryClient();
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      api.patch(`/workspaces/current/members/${userId}`, { role }),
    onSuccess: (_res, { role }) => {
      // Handing over ownership changes your own role too.
      if (role === "owner") dispatch(checkAuth());
      return qc.invalidateQueries({ queryKey: keys.workspace.members });
    },
  });
};

export const useRemoveMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete(`/workspaces/current/members/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.workspace.members });
      return qc.invalidateQueries({ queryKey: keys.team.members });
    },
  });
};

/* ---- Invites ---- */

export const useInvites = ({ enabled = true } = {}) =>
  useQuery({
    queryKey: keys.workspace.invites,
    queryFn: () => api.get<Invite[]>("/workspaces/current/invites").then((r) => r.data),
    enabled,
  });

export const useCreateInvite = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { role?: "admin" | "member"; email?: string; expiresInDays?: number; maxUses?: number }) =>
      api.post<Invite>("/workspaces/current/invites", input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.workspace.invites }),
  });
};

export const useRevokeInvite = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => api.delete(`/workspaces/current/invites/${inviteId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.workspace.invites }),
  });
};

/** Public: what the invite link leads to. */
export const useInvitePreview = (token: string | undefined) =>
  useQuery({
    queryKey: keys.workspace.invite(token ?? ""),
    queryFn: () => api.get<InvitePreview>(`/invites/${token}`).then((r) => r.data),
    enabled: Boolean(token),
    retry: false,
  });

export const useAcceptInvite = () => {
  const refresh = useRefreshSession();
  return useMutation({
    mutationFn: (token: string) =>
      api
        .post<{ workspace: { _id: string; name: string }; alreadyMember: boolean }>(`/invites/${token}/accept`)
        .then((r) => r.data),
    onSuccess: async () => {
      await refresh();
    },
  });
};

/* ---- Audit log, export, delete (admins / owner) ---- */

const auditParams = (filter: AuditFilter) =>
  Object.fromEntries(Object.entries(filter).filter(([, v]) => v)) as Record<string, string>;

export const useAuditLog = (filter: AuditFilter, { enabled = true } = {}) =>
  useInfiniteQuery({
    queryKey: ["workspace", "audit", filter],
    queryFn: ({ pageParam }) =>
      api
        .get<AuditPage>("/workspaces/current/audit", { params: { ...auditParams(filter), before: pageParam, limit: 50 } })
        .then((r) => r.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  });

/** Downloads the filtered audit log as CSV (small enough to fetch whole). */
export const downloadAuditCsv = async (filter: AuditFilter) => {
  const res = await api.get<Blob>("/workspaces/current/audit.csv", { params: auditParams(filter), responseType: "blob" });
  saveBlob(res.data, `audit-log-${new Date().toISOString().slice(0, 10)}.csv`);
};

const saveBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * Exports can be large, so the browser downloads them directly (streamed, with
 * its own progress bar) instead of holding them in memory here.
 */
export const exportUrl = (kind: "workspace" | "me", { files = true } = {}) =>
  `${api.defaults.baseURL}${kind === "me" ? "/me/export" : `/workspaces/current/export${files ? "" : "?files=0"}`}`;

export const useDeleteWorkspace = () => {
  const refresh = useRefreshSession();
  return useMutation({
    mutationFn: (confirmName: string) => api.delete("/workspaces/current", { data: { confirmName } }),
    onSuccess: refresh,
  });
};

/* ---- Webhooks (admins) ---- */

const hooksKey = ["workspace", "webhooks"] as const;

export const useWebhooks = () =>
  useQuery({ queryKey: hooksKey, queryFn: () => api.get<Webhook[]>("/workspaces/current/webhooks").then((r) => r.data) });

const useHookMutation = <V, R>(fn: (v: V) => Promise<R>) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSettled: () => qc.invalidateQueries({ queryKey: hooksKey }) });
};

export const useCreateWebhook = () =>
  useHookMutation((input: WebhookInput) => api.post<Webhook>("/workspaces/current/webhooks", input).then((r) => r.data));

export const useUpdateWebhook = () =>
  useHookMutation(({ id, ...input }: Partial<WebhookInput> & { id: string }) =>
    api.patch<Webhook>(`/workspaces/current/webhooks/${id}`, input).then((r) => r.data),
  );

export const useDeleteWebhook = () => useHookMutation((id: string) => api.delete(`/workspaces/current/webhooks/${id}`));

export const useRotateWebhookSecret = () =>
  useHookMutation((id: string) => api.post<Webhook>(`/workspaces/current/webhooks/${id}/rotate-secret`).then((r) => r.data));

export const useTestWebhook = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api
        .post<{ ok: boolean; statusCode: number | null; error: string | null; durationMs: number }>(`/workspaces/current/webhooks/${id}/test`)
        .then((r) => r.data),
    onSettled: (_d, _e, id) => {
      qc.invalidateQueries({ queryKey: hooksKey });
      qc.invalidateQueries({ queryKey: ["workspace", "webhooks", id, "deliveries"] });
    },
  });
};

export const useWebhookDeliveries = (id: string | null) =>
  useQuery({
    queryKey: ["workspace", "webhooks", id, "deliveries"],
    queryFn: () => api.get<WebhookDelivery[]>(`/workspaces/current/webhooks/${id}/deliveries`).then((r) => r.data),
    enabled: Boolean(id),
  });
