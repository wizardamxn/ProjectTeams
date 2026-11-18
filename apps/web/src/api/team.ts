import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { keys } from "./queryClient";
import type { TeamMember } from "./types";

export const useTeamMembers = ({ enabled = true } = {}) =>
  useQuery({
    enabled,
    queryKey: keys.team.members,
    queryFn: () => api.get<TeamMember[]>("/profile/teammembers").then((r) => r.data),
  });
