import type { WorkspaceContext } from "../workspaces/workspaces.service.js";
import { workspacesService } from "../workspaces/workspaces.service.js";

export const usersService = {
  /** Everyone else in the active workspace (for pickers and the command palette). */
  async listTeammates(ctx: WorkspaceContext) {
    const members = await workspacesService.listMembers(ctx);
    return members.filter((m) => m._id !== ctx.user._id.toString());
  },
};
