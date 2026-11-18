import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { ctxOf, requireWorkspace } from "../../middleware/workspace.js";
import { searchService } from "./search.service.js";

export const searchRouter = Router();
searchRouter.use(requireAuth, requireWorkspace);

/** GET /api/search?q=launch */
searchRouter.get("/", async (req, res) => {
  res.json(await searchService.search(ctxOf(req), typeof req.query.q === "string" ? req.query.q : ""));
});
