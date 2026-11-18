import type { UserDoc } from "../models/user.js";

declare global {
  namespace Express {
    interface Request {
      /** Set by `requireAuth`. */
      user?: UserDoc;
    }
  }
}

export {};
