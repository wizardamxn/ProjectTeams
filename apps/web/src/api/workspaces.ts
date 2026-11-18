import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppDispatch } from "@/store/hooks";
import { checkAuth } from "@/store/slices/User";
import { keys } from "./queryClient";
import type { Invite, InvitePreview, Member, Role } from "./types";

/**
 * Anything that changes which workspace you're in, or your role in it,
 * reloads the session and drops every cached query (they belong to the old workspace).
 */
const useRefreshSession = () => {
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
