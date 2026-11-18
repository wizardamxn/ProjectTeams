import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { keys } from "./queryClient";
import type { Doc, DocInput, DocVersion, DocVersionSummary, Folder } from "./types";

export interface DocFilter {
  folderId?: string; // a folder id, or "none"
  starred?: boolean;
  mine?: boolean;
}

const docsApi = {
  list: (f: DocFilter = {}) =>
    api
      .get<Doc[]>("/doc/list", {
        params: { folderId: f.folderId, starred: f.starred ? 1 : undefined, mine: f.mine ? 1 : undefined },
      })
      .then((r) => r.data),
  get: (id: string) => api.get<Doc>(`/doc/doc/${id}`).then((r) => r.data),
  create: (input: DocInput) => api.post<{ document: Doc }>("/doc/create", input).then((r) => r.data.document),
  update: (id: string, input: Partial<DocInput>) => api.put<Doc>(`/doc/edit/${id}`, input).then((r) => r.data),
  toggleStar: (id: string) => api.put<Doc>(`/doc/star/${id}`).then((r) => r.data),
  remove: (id: string) => api.delete(`/doc/teamdocs/${id}`).then(() => id),
};

export const useDocs = (filter: DocFilter = {}) =>
  useQuery({ queryKey: [...keys.docs.all, "list", filter], queryFn: () => docsApi.list(filter) });

export const useTeamDocs = ({ enabled = true } = {}) =>
  useQuery({ queryKey: keys.docs.team(), queryFn: () => docsApi.list(), enabled });
export const useStarredDocs = () => useQuery({ queryKey: keys.docs.starred(), queryFn: () => docsApi.list({ starred: true }) });
export const useMyDocs = () => useQuery({ queryKey: keys.docs.mine(), queryFn: () => docsApi.list({ mine: true }) });

export const useDoc = (id: string | undefined) =>
  useQuery({
    queryKey: keys.docs.detail(id ?? ""),
    queryFn: () => docsApi.get(id!),
    enabled: Boolean(id),
    staleTime: Infinity, // the open editor is the source of truth while editing
  });

export const useCreateDoc = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: docsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.docs.all }),
  });
};

/** Autosave. Lists are refreshed in the background; the open doc isn't refetched. */
export const useUpdateDoc = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<DocInput> }) => docsApi.update(id, input),
    onSuccess: (doc) => {
      qc.setQueryData(keys.docs.detail(doc._id), doc);
      qc.invalidateQueries({ queryKey: keys.docs.all, predicate: (q) => q.queryKey[1] !== "detail" });
      qc.invalidateQueries({ queryKey: ["docs", "versions", doc._id] });
      qc.invalidateQueries({ queryKey: ["docs", "folders"] });
    },
  });
};

/** Changes every cached list right away, and puts it back if the server says no. */
const useOptimisticDocListChange = (
  mutationFn: (id: string) => Promise<unknown>,
  change: (list: Doc[], id: string) => Doc[],
) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: keys.docs.all });
      const snapshot = qc.getQueriesData<Doc[]>({ queryKey: keys.docs.all });
      for (const [key, list] of snapshot) {
        if (Array.isArray(list)) qc.setQueryData(key, change(list, id));
      }
      return { snapshot };
    },
    onError: (_err, _id, ctx) => ctx?.snapshot.forEach(([key, list]) => qc.setQueryData(key, list)),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.docs.all }),
  });
};

export const useToggleStar = () =>
  useOptimisticDocListChange(docsApi.toggleStar, (list, id) =>
    list.map((d) => (d._id === id ? { ...d, starred: !d.starred } : d)),
  );

export const useDeleteDoc = () =>
  useOptimisticDocListChange(docsApi.remove, (list, id) => list.filter((d) => d._id !== id));

/* ---- History ---- */

export const useVersions = (docId: string | undefined, { enabled = true } = {}) =>
  useQuery({
    queryKey: ["docs", "versions", docId ?? ""],
    queryFn: () => api.get<DocVersionSummary[]>(`/doc/doc/${docId}/versions`).then((r) => r.data),
    enabled: Boolean(docId) && enabled,
  });

export const useVersion = (docId: string | undefined, versionId: string | null) =>
  useQuery({
    queryKey: ["docs", "version", docId ?? "", versionId ?? ""],
    queryFn: () => api.get<DocVersion>(`/doc/doc/${docId}/versions/${versionId}`).then((r) => r.data),
    enabled: Boolean(docId && versionId),
    staleTime: Infinity,
  });

export const useRestoreVersion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ docId, versionId }: { docId: string; versionId: string }) =>
      api.post<Doc>(`/doc/doc/${docId}/versions/${versionId}/restore`).then((r) => r.data),
    onSuccess: (doc) => {
      qc.setQueryData(keys.docs.detail(doc._id), doc);
      qc.invalidateQueries({ queryKey: ["docs", "versions", doc._id] });
      qc.invalidateQueries({ queryKey: keys.docs.all, predicate: (q) => q.queryKey[1] !== "detail" });
    },
  });
};

/* ---- Folders ---- */

export const useFolders = () =>
  useQuery({ queryKey: ["docs", "folders"], queryFn: () => api.get<Folder[]>("/doc/folders").then((r) => r.data) });

const useFolderMutation = <T,>(fn: (arg: T) => Promise<unknown>) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["docs", "folders"] });
      qc.invalidateQueries({ queryKey: keys.docs.all });
    },
  });
};

export const useCreateFolder = () =>
  useFolderMutation((name: string) => api.post<Folder>("/doc/folders", { name }).then((r) => r.data));
export const useRenameFolder = () =>
  useFolderMutation(({ id, name }: { id: string; name: string }) => api.patch(`/doc/folders/${id}`, { name }));
export const useDeleteFolder = () => useFolderMutation((id: string) => api.delete(`/doc/folders/${id}`));
