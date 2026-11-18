import * as Y from "yjs";
import { Types } from "mongoose";
import { Node as PMNode } from "@tiptap/pm/model";
import { prosemirrorJSONToYDoc, prosemirrorToYXmlFragment, yDocToProsemirrorJSON } from "@tiptap/y-tiptap";
import { docSchema } from "../../lib/docSchema.js";
import { logger } from "../../lib/logger.js";
import { plainToRichText, richTextToPlain } from "../../lib/richText.js";
import { Document } from "../../models/document.js";
import { DocUpdate } from "../../models/docUpdate.js";
import { emitToRoom } from "../../realtime/emitter.js";
// Circular on purpose (docs.service calls back in here); both are only used inside functions.
import { saveDerivedContent } from "../docs/docs.service.js";

// Live co-editing. Each doc's body is a Yjs document: clients exchange small
// updates over Socket.IO, and every update is appended to `docupdates`. The
// plain fields the rest of the app reads (contentJson, content) are derived
// from it here, a moment after edits stop.

/** Tiptap's Collaboration extension stores the body in this fragment. */
export const FIELD = "default";
export const docRoom = (docId: string) => `doc:${docId}`;

/** Updates bigger than this are refused (a huge paste is still well under it). */
export const MAX_UPDATE_BYTES = 1024 * 1024;
const MATERIALIZE_AFTER_MS = 2000;
const COMPACT_AFTER_UPDATES = 200;

/* ---------------- Pure helpers (unit tested) ---------------- */

/** Editor JSON as a Yjs state. Unknown nodes fall back to plain paragraphs. */
export const jsonToState = (json: unknown): Uint8Array => {
  let doc: Y.Doc;
  try {
    doc = prosemirrorJSONToYDoc(docSchema, json, FIELD);
  } catch {
    doc = prosemirrorJSONToYDoc(docSchema, plainToRichText(richTextToPlain(json)), FIELD);
  }
  return Y.encodeStateAsUpdate(doc);
};

export const stateToJson = (state: Uint8Array): Record<string, unknown> => {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, state);
  return yDocToProsemirrorJSON(doc, FIELD) as Record<string, unknown>;
};

/** True if the bytes decode as a Yjs update. */
export const isValidUpdate = (update: Uint8Array) => {
  if (update.byteLength === 0 || update.byteLength > MAX_UPDATE_BYTES) return false;
  try {
    Y.decodeUpdate(update);
    return true;
  } catch {
    return false;
  }
};

/**
 * The update that turns `state` into one whose body is `json`. Applied by
 * every client, it replaces the body for everyone (used by version restore).
 */
export const replaceUpdate = (state: Uint8Array, json: unknown): Uint8Array => {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, state);
  const before = Y.encodeStateVector(doc);
  let node: PMNode;
  try {
    node = PMNode.fromJSON(docSchema, json);
  } catch {
    // Content the schema doesn't know: keep its text as paragraphs.
    node = PMNode.fromJSON(docSchema, plainToRichText(richTextToPlain(json)));
  }
  doc.transact(() => {
    const fragment = doc.getXmlFragment(FIELD);
    fragment.delete(0, fragment.length);
    prosemirrorToYXmlFragment(node, fragment);
  });
  return Y.encodeStateAsUpdate(doc, before);
};

/* ---------------- Storage ---------------- */

const toBuf = (u: Uint8Array) => Buffer.from(u.buffer, u.byteOffset, u.byteLength);
/** Bytes from a Buffer, or from the BSON Binary that `.lean()` returns. */
const toU8 = (b: unknown): Uint8Array => {
  if (b instanceof Uint8Array) return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  const bin = b as { buffer: Uint8Array; position: number };
  return bin.buffer.subarray(0, bin.position);
};

/**
 * The doc's current state: compacted base plus later updates. The first time
 * a doc is opened live, its existing body becomes the base.
 */
export const loadState = async (docId: string): Promise<{ state: Uint8Array; lastUpdateId: Types.ObjectId | null }> => {
  for (let attempt = 0; attempt < 3; attempt++) {
    let doc = await Document.findById(docId).select("+ystate +ycompactedUntil contentJson content").lean();
    if (!doc) throw new Error("Document not found");

    if (!doc.ystate) {
      const seeded = toBuf(jsonToState(doc.contentJson ?? plainToRichText(doc.content)));
      // Only one opener may seed; everyone else uses the winner's base.
      await Document.updateOne({ _id: docId, ystate: { $exists: false } }, { $set: { ystate: seeded } });
      doc = await Document.findById(docId).select("+ystate +ycompactedUntil").lean();
      if (!doc?.ystate) throw new Error("Document not found");
    }

    const after = doc.ycompactedUntil;
    const updates = await DocUpdate.find({ docId, ...(after ? { _id: { $gt: after } } : {}) }).sort({ _id: 1 }).lean();

    // A compaction between the two reads could have folded in (and deleted)
    // updates our base doesn't have. Rare; just read again.
    const now = await Document.findById(docId).select("+ycompactedUntil").lean();
    if (String(now?.ycompactedUntil ?? "") !== String(after ?? "")) continue;

    const parts = [toU8(doc.ystate), ...updates.map((u) => toU8(u.update))];
    return {
      state: parts.length === 1 ? parts[0]! : Y.mergeUpdates(parts),
      lastUpdateId: updates.at(-1)?._id ?? null,
    };
  }
  throw new Error("Could not read a stable document state");
};

/* ---------------- Writes ---------------- */

/** Who last edited each doc with pending changes (for lastEditedBy). */
const pending = new Map<string, { timer: NodeJS.Timeout; userId?: string }>();

const schedule = (docId: string, userId?: string) => {
  const prev = pending.get(docId);
  if (prev) clearTimeout(prev.timer);
  const timer = setTimeout(() => {
    pending.delete(docId);
    void collab.materialize(docId, userId).catch((err) => logger.error({ err, docId }, "materialize failed"));
  }, MATERIALIZE_AFTER_MS);
  timer.unref?.();
  pending.set(docId, { timer, userId: userId ?? prev?.userId });
};

export const collab = {
  /** Stores one client update. The caller has already checked access and validity. */
  async applyUpdate(docId: string, update: Uint8Array, userId?: string) {
    await DocUpdate.create({ docId, userId, update: toBuf(update) });
    schedule(docId, userId);
  },

  /** Recomputes contentJson/content from the live state (debounced after edits). */
  async materialize(docId: string, userId?: string, opts: { snapshot?: boolean } = {}) {
    const { state, lastUpdateId } = await loadState(docId);
    await saveDerivedContent(docId, stateToJson(state), userId, opts);
    if (lastUpdateId) await this.compactIfNeeded(docId, state, lastUpdateId);
  },

  /** Folds old updates into the base once there are enough of them. */
  async compactIfNeeded(docId: string, state: Uint8Array, lastUpdateId: Types.ObjectId) {
    const count = await DocUpdate.countDocuments({ docId, _id: { $lte: lastUpdateId } });
    if (count < COMPACT_AFTER_UPDATES) return;
    // Only move forward: a slower compactor with an older view must not win.
    const res = await Document.updateOne(
      { _id: docId, $or: [{ ycompactedUntil: { $exists: false } }, { ycompactedUntil: { $lt: lastUpdateId } }] },
      { $set: { ystate: toBuf(state), ycompactedUntil: lastUpdateId } },
    );
    if (res.modifiedCount) await DocUpdate.deleteMany({ docId, _id: { $lte: lastUpdateId } });
  },

  /**
   * Replaces the body for everyone (restore a version, or a REST save with
   * content). Live editors receive the change like any other edit.
   */
  async replaceContent(docId: string, json: Record<string, unknown>, userId: string, opts: { snapshot?: boolean } = {}) {
    const { state } = await loadState(docId);
    const update = replaceUpdate(state, json);
    await DocUpdate.create({ docId, userId, update: toBuf(update) });
    emitToRoom(docRoom(docId), "doc:update", { docId, update: toBuf(update) });
    const prev = pending.get(docId);
    if (prev) {
      clearTimeout(prev.timer);
      pending.delete(docId);
    }
    await this.materialize(docId, userId, opts);
  },

  /** Removes all live state for a deleted doc. */
  async forget(docIds: (string | Types.ObjectId)[]) {
    for (const id of docIds) {
      const p = pending.get(String(id));
      if (p) clearTimeout(p.timer);
      pending.delete(String(id));
      emitToRoom(docRoom(String(id)), "doc:deleted", { docId: String(id) });
    }
    await DocUpdate.deleteMany({ docId: { $in: docIds } });
  },
};
