import type { UserDoc } from "../models/user.js";
import type { WorkspaceContext } from "../modules/workspaces/workspaces.service.js";

declare global {
  namespace Express {
    interface Request {
      /** Set by `requireAuth`. */
      user?: UserDoc;
      /** Set by `requireWorkspace`. */
      ctx?: WorkspaceContext;
    }
  }
}

export {};
