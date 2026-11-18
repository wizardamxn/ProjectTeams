import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { ctxOf, requireWorkspace } from "../../middleware/workspace.js";
import { chatService } from "./chat.service.js";

export const chatRouter = Router();

chatRouter.use(requireAuth, requireWorkspace);

// History between the logged-in user and a teammate. The caller is always one
// side of the chat; the client can never choose it.
chatRouter.get("/with/:targetUserId", async (req, res) => {
  res.json(await chatService.openWith(ctxOf(req), String(req.params.targetUserId)));
});
