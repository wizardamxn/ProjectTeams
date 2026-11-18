// In-memory presence: userId -> open socket ids (one per tab).
// Single-process only; Phase 4 moves this to Redis with the Socket.IO adapter.
const online = new Map<string, Set<string>>();

export const presence = {
  add(userId: string, socketId: string) {
    let sockets = online.get(userId);
    if (!sockets) online.set(userId, (sockets = new Set()));
    sockets.add(socketId);
  },
  remove(userId: string, socketId: string) {
    const sockets = online.get(userId);
    if (!sockets) return;
    sockets.delete(socketId);
    if (sockets.size === 0) online.delete(userId);
  },
  isOnline: (userId: string) => online.has(userId),
};
