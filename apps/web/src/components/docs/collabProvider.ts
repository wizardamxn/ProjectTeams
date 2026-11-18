import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";
import socket from "@/utils/socket";

// Connects a Yjs doc to the server over the app's socket (see the API's
// realtime/docSync.ts). On every (re)connect it fetches the server's state,
// merges it, and sends back whatever the server is missing, so edits made
// while offline aren't lost.

export type SyncStatus = "connecting" | "synced" | "offline" | "error";

type Bytes = ArrayBuffer | Uint8Array;
const bytes = (b: Bytes) => (b instanceof Uint8Array ? b : new Uint8Array(b));

export class SocketProvider {
  readonly awareness: Awareness;
  status: SyncStatus = "connecting";
  private joined = false;
  private listeners = new Set<(s: SyncStatus) => void>();
  private destroyed = false;

  constructor(
    readonly docId: string,
    readonly doc: Y.Doc,
  ) {
    this.awareness = new Awareness(doc);
    doc.on("update", this.onLocalUpdate);
    this.awareness.on("update", this.onLocalAwareness);
    socket.on("connect", this.join);
    socket.on("disconnect", this.onDisconnect);
    socket.on("doc:update", this.onRemoteUpdate);
    socket.on("doc:awareness", this.onRemoteAwareness);
    socket.on("doc:error", this.onError);
    window.addEventListener("beforeunload", this.leaveAwareness);
    if (socket.connected) this.join();
    else this.setStatus(navigator.onLine ? "connecting" : "offline");
  }

  onStatus(fn: (s: SyncStatus) => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  private setStatus(s: SyncStatus) {
    this.status = s;
    this.listeners.forEach((fn) => fn(s));
  }

  private join = () => {
    if (this.destroyed) return;
    this.setStatus("connecting");
    socket.emit("doc:join", { docId: this.docId }, (res: { ok: true; state: Bytes } | { ok: false; error: string }) => {
      if (this.destroyed) return;
      if (!res?.ok) return this.setStatus("error");
      const serverState = bytes(res.state);
      Y.applyUpdate(this.doc, serverState, this);
      // Anything typed here that the server hasn't seen (e.g. while offline).
      const missing = Y.encodeStateAsUpdate(this.doc, Y.encodeStateVectorFromUpdate(serverState));
      if (missing.byteLength > 2) socket.emit("doc:update", { docId: this.docId, update: missing });
      this.joined = true;
      this.setStatus("synced");
      // Tell the others we're here (and where our cursor is).
      socket.emit("doc:awareness", { docId: this.docId, update: encodeAwarenessUpdate(this.awareness, [this.doc.clientID]) });
    });
  };

  private onDisconnect = () => {
    this.joined = false;
    // Others' cursors are stale until we're back.
    const others = [...this.awareness.getStates().keys()].filter((id) => id !== this.doc.clientID);
    removeAwarenessStates(this.awareness, others, "remote");
    this.setStatus("offline");
  };

  private onLocalUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this || !this.joined || !socket.connected) return; // resent on the next join
    socket.emit("doc:update", { docId: this.docId, update });
  };

  private onRemoteUpdate = ({ docId, update }: { docId: string; update: Bytes }) => {
    if (docId === this.docId) Y.applyUpdate(this.doc, bytes(update), this);
  };

  private onLocalAwareness = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
    if (origin === "remote" || !this.joined || !socket.connected) return;
    const changed = added.concat(updated, removed);
    socket.emit("doc:awareness", { docId: this.docId, update: encodeAwarenessUpdate(this.awareness, changed) });
  };

  private onRemoteAwareness = ({ docId, update }: { docId: string; update: Bytes }) => {
    if (docId === this.docId) applyAwarenessUpdate(this.awareness, bytes(update), "remote");
  };

  private onError = ({ docId }: { docId: string; error: string }) => {
    // The server refused or lost an update: resync from scratch.
    if (docId === this.docId && socket.connected) this.join();
  };

  private leaveAwareness = () => {
    removeAwarenessStates(this.awareness, [this.doc.clientID], "local");
    if (socket.connected) {
      socket.emit("doc:awareness", { docId: this.docId, update: encodeAwarenessUpdate(this.awareness, [this.doc.clientID]) });
    }
  };

  destroy() {
    this.destroyed = true;
    this.leaveAwareness();
    if (socket.connected) socket.emit("doc:leave", { docId: this.docId });
    this.doc.off("update", this.onLocalUpdate);
    this.awareness.off("update", this.onLocalAwareness);
    socket.off("connect", this.join);
    socket.off("disconnect", this.onDisconnect);
    socket.off("doc:update", this.onRemoteUpdate);
    socket.off("doc:awareness", this.onRemoteAwareness);
    socket.off("doc:error", this.onError);
    window.removeEventListener("beforeunload", this.leaveAwareness);
    this.awareness.destroy();
    this.listeners.clear();
  }
}
