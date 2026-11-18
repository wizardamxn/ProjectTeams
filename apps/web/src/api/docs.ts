import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { keys } from "./queryClient";
import type { Doc, DocInput } from "./types";

const docsApi = {
  team: () => api.get<Doc[]>("/doc/teamdocs").then((r) => r.data),
  starred: () => api.get<Doc[]>("/doc/starred").then((r) => r.data),
  mine: () => api.get<Doc[]>("/doc/viewdocs").then((r) => r.data),
  get: (id: string) => api.get<Doc>(`/doc/doc/${id}`).then((r) => r.data),
  create: (input: DocInput) =>
    api.post<{ document: Doc }>("/doc/create", input).then((r) => r.data.document),
  update: (id: string, input: Partial<DocInput>) =>
    api.put<Doc>(`/doc/edit/${id}`, input).then((r) => r.data),
  toggleStar: (id: string) => api.put<Doc>(`/doc/star/${id}`).then((r) => r.data),
  remove: (id: string) => api.delete(`/doc/teamdocs/${id}`).then(() => id),
};

export const useTeamDocs = ({ enabled = true } = {}) =>
  useQuery({ queryKey: keys.docs.team(), queryFn: docsApi.team, enabled });
export const useStarredDocs = () => useQuery({ queryKey: keys.docs.starred(), queryFn: docsApi.starred });
export const useMyDocs = () => useQuery({ queryKey: keys.docs.mine(), queryFn: docsApi.mine });

export const useDoc = (id: string | undefined) =>
  useQuery({
    queryKey: keys.docs.detail(id ?? ""),
    queryFn: () => docsApi.get(id!),
    enabled: Boolean(id),
  });

export const useCreateDoc = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: docsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.docs.all }),
  });
};

export const useUpdateDoc = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<DocInput> }) => docsApi.update(id, input),
    onSuccess: (doc) => {
      qc.setQueryData(keys.docs.detail(doc._id), doc);
      return qc.invalidateQueries({ queryKey: keys.docs.all });
    },
  });
};

/** Removes the doc from every cached list right away, and puts it back if the server says no. */
const useOptimisticDocListChange = <TArg extends string>(
  mutationFn: (id: TArg) => Promise<unknown>,
  change: (list: Doc[], id: string) => Doc[],
) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: async (id: TArg) => {
      await qc.cancelQueries({ queryKey: keys.docs.all });
      const snapshot = qc.getQueriesData<Doc[]>({ queryKey: keys.docs.all });
      for (const [key, list] of snapshot) {
        if (Array.isArray(list)) qc.setQueryData(key, change(list, id));
      }
      return { snapshot };
    },
    onError: (_err, _id, ctx) => {
      ctx?.snapshot.forEach(([key, list]) => qc.setQueryData(key, list));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.docs.all }),
  });
};

export const useToggleStar = () =>
  useOptimisticDocListChange(docsApi.toggleStar, (list, id) =>
    list.map((d) => (d._id === id ? { ...d, starred: !d.starred } : d)),
  );

export const useDeleteDoc = () =>
  useOptimisticDocListChange(docsApi.remove, (list, id) => list.filter((d) => d._id !== id));
