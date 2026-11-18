import type { Server } from "socket.io";

// Services publish realtime events through here, without knowing about
// Socket.IO setup. Before the socket server starts (or in HTTP-only tests)
// events are simply dropped.

let io: Server | undefined;

export const setRealtimeServer = (server: Server | undefined) => {
  io = server;
};

export const userRoom = (userId: string) => `user:${userId}`;
export const workspaceRoom = (workspaceId: string) => `ws:${workspaceId}`;

export const emitToUsers = (userIds: Iterable<string>, event: string, payload: unknown) => {
  const rooms = [...new Set(userIds)].map(userRoom);
  if (io && rooms.length) io.to(rooms).emit(event, payload);
};

export const emitToWorkspace = (workspaceId: string, event: string, payload: unknown) => {
  io?.to(workspaceRoom(workspaceId)).emit(event, payload);
};
