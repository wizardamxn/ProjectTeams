import type { Socket } from "socket.io";
import { Types } from "mongoose";
import { logger } from "../lib/logger.js";
import { Document } from "../models/document.js";
import { Membership } from "../models/membership.js";
import type { UserDoc } from "../models/user.js";
import { collab, docRoom, isValidUpdate, loadState } from "../modules/collab/collab.service.js";

// Live co-editing over the existing socket. The protocol is small:
//   doc:join   {docId}            -> ack {ok, state}   (full Yjs state; client then sends what the server lacks)
//   doc:update {docId, update}    -> stored, then relayed to everyone else in the doc
//   doc:awareness {docId, update} -> relayed only (cursors, selections, who's here)
//   doc:leave  {docId}
// Server-sent: doc:update, doc:awareness, doc:saved, doc:comments, doc:deleted.

const MAX_AWARENESS_BYTES = 16 * 1024;
const MAX_UPDATES_PER_SECOND = 60;

const asBytes = (v: unknown): Uint8Array | null => {
  if (v instanceof Uint8Array) return v; // Buffer is a Uint8Array
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  return null;
};

const validId = (v: unknown): v is string => typeof v === "string" && Types.ObjectId.isValid(v);

/** You can open a doc if you belong to its workspace (any of yours, not just the active one). */
const canAccess = async (user: UserDoc, docId: string) => {
  const doc = await Document.findById(docId).select("teamId").lean();
  if (!doc || !Types.ObjectId.isValid(doc.teamId)) return false;
  return Boolean(await Membership.exists({ workspaceId: doc.teamId, userId: user._id }));
};

type Ack = (res: { ok: true; state: Buffer } | { ok: false; error: string }) => void;

export const registerDocSync = (socket: Socket, user: UserDoc) => {
  const userId = user._id.toString();
  let windowStart = 0;
  let inWindow = 0;
  const overLimit = () => {
    const now = Date.now();
    if (now - windowStart > 1000) {
      windowStart = now;
      inWindow = 0;
    }
    return ++inWindow > MAX_UPDATES_PER_SECOND;
  };

  socket.on("doc:join", async (payload: { docId?: unknown } | undefined, ack: Ack) => {
    if (typeof ack !== "function") return;
    const docId = payload?.docId;
    try {
      if (!validId(docId) || !(await canAccess(user, docId))) return ack({ ok: false, error: "not_found" });
      await socket.join(docRoom(docId));
      const { state } = await loadState(docId);
      ack({ ok: true, state: Buffer.from(state) });
    } catch (err) {
      logger.error({ err, docId }, "doc:join failed");
      ack({ ok: false, error: "server_error" });
    }
  });

  socket.on("doc:update", async (payload: { docId?: unknown; update?: unknown } | undefined) => {
    const docId = payload?.docId;
    const update = asBytes(payload?.update);
    if (!validId(docId) || !update || !socket.rooms.has(docRoom(docId))) return;
    if (overLimit() || !isValidUpdate(update)) {
      socket.emit("doc:error", { docId, error: "rejected" });
      return;
    }
    try {
      await collab.applyUpdate(docId, update, userId);
      socket.to(docRoom(docId)).emit("doc:update", { docId, update: Buffer.from(update) });
    } catch (err) {
      logger.error({ err, docId }, "doc:update failed");
      // Make the client resync, so nothing typed is lost.
      socket.emit("doc:error", { docId, error: "resync" });
    }
  });

  socket.on("doc:awareness", (payload: { docId?: unknown; update?: unknown } | undefined) => {
    const docId = payload?.docId;
    const update = asBytes(payload?.update);
    if (!validId(docId) || !update || update.byteLength > MAX_AWARENESS_BYTES || !socket.rooms.has(docRoom(docId))) return;
    socket.to(docRoom(docId)).emit("doc:awareness", { docId, update: Buffer.from(update) });
  });

  socket.on("doc:leave", async (payload: { docId?: unknown } | undefined) => {
    const docId = payload?.docId;
    if (validId(docId)) await socket.leave(docRoom(docId));
  });
};
