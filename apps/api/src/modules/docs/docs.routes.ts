import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { ctxOf, requireWorkspace } from "../../middleware/workspace.js";
import { requireObjectIds, validateBody } from "../../middleware/validate.js";
import { createDocSchema, updateDocSchema } from "./docs.schemas.js";
import { docsService } from "./docs.service.js";

// Mounted at /api/doc (paths kept for frontend compatibility).
export const docsRouter = Router();

docsRouter.use(requireAuth, requireWorkspace);
docsRouter.param("doc_id", (req, _res, next) => requireObjectIds("doc_id")(req, _res, next));

docsRouter.post("/create", validateBody(createDocSchema), async (req, res) => {
  const document = await docsService.create(ctxOf(req), req.body);
  res.status(201).json({ message: "Document Created Successfully", document });
});

docsRouter.get("/viewdocs", async (req, res) => {
  res.json(await docsService.listMine(ctxOf(req)));
});

docsRouter.get("/teamdocs", async (req, res) => {
  res.json(await docsService.listTeam(ctxOf(req)));
});

docsRouter.get("/starred", async (req, res) => {
  res.json(await docsService.listStarred(ctxOf(req)));
});

docsRouter.get("/doc/:doc_id", async (req, res) => {
  res.json(await docsService.get(ctxOf(req), String(req.params.doc_id)));
});

docsRouter.put("/edit/:doc_id", validateBody(updateDocSchema), async (req, res) => {
  res.json(await docsService.update(ctxOf(req), String(req.params.doc_id), req.body));
});

docsRouter.put("/star/:doc_id", async (req, res) => {
  res.json(await docsService.toggleStar(ctxOf(req), String(req.params.doc_id)));
});

docsRouter.delete("/teamdocs/:doc_id", async (req, res) => {
  await docsService.remove(ctxOf(req), String(req.params.doc_id));
  res.json({ message: "Document deleted" });
});
