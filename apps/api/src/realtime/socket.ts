import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { parseCookie } from "cookie";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";
import { getRedis } from "../lib/redis.js";
import { AUTH_COOKIE, getUserFromToken } from "../middleware/auth.js";
import { ConversationMember } from "../models/conversation.js";
import { Membership } from "../models/membership.js";
import type { UserDoc } from "../models/user.js";
import { workspacesService } from "../modules/workspaces/workspaces.service.js";
import { emitToUsers, emitToWorkspace, setRealtimeServer, userRoom, workspaceRoom } from "./emitter.js";
import { presence } from "./presence.js";
import { registerDocSync } from "./docSync.js";
import { MAX_UPDATE_BYTES } from "../modules/collab/collab.service.js";

// Sockets mostly *deliver* events (new messages, edits, typing, presence,
// notifications); those changes go through the REST API, which checks
// permissions and then publishes through ./emitter.ts. The one exception is
// live doc editing (./docSync.ts), which streams small edits both ways.

interface SocketData {
  user: UserDoc;
  workspaceId?: string;
}

interface ClientEvents {
  typing: (payload: { conversationId?: string } | undefined) => void;
  "presence:list": (callback: (onlineUserIds: string[]) => void) => void;
}

interface ServerEvents {
  typing: (event: { conversationId: string; userId: string; fullName: string }) => void;
  "presence:update": (event: { userId: string; online: boolean }) => void;
  [event: string]: (...args: never[]) => void;
}

const TYPING_THROTTLE_MS = 2000;

export const initializeSocket = (server: HttpServer) => {
  const io = new Server<ClientEvents, ServerEvents, Record<string, never>, SocketData>(server, {
    cors: { origin: config.CORS_ORIGINS, credentials: true },
    // Room for one large live-editing update (a big paste) plus framing.
    maxHttpBufferSize: MAX_UPDATE_BYTES + 64 * 1024,
  });

  if (config.REALTIME_REDIS) {
    const pub = getRedis().duplicate();
    const sub = getRedis().duplicate();
    io.adapter(createAdapter(pub, sub));
    logger.info("Socket.IO using the Redis adapter");
  }

  // Every socket must carry a valid session cookie.
  io.use(async (socket, next) => {
    try {
      const cookies = parseCookie(socket.handshake.headers.cookie ?? "");
      const user = await getUserFromToken(cookies[AUTH_COOKIE]);
      if (!user) return next(new Error("unauthorized"));
      socket.data.user = user;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const { user } = socket.data;
    const userId = user._id.toString();
    // Before any await, so a doc:join sent right after connecting isn't missed.
    registerDocSync(socket as never, user);
    await socket.join(userRoom(userId));

    // The workspace this socket works in. The client reconnects after switching.
    const ctx = await workspacesService.resolveActive(user).catch(() => null);
    const workspaceId = ctx?.key;
    socket.data.workspaceId = workspaceId;
    if (workspaceId) await socket.join(workspaceRoom(workspaceId));

    if (await presence().add(userId, socket.id)) {
      if (workspaceId) emitToWorkspace(workspaceId, "presence:update", { userId, online: true });
    }

    socket.on("presence:list", async (callback) => {
      if (typeof callback !== "function" || !workspaceId) return;
      const members = await Membership.find({ workspaceId }).select("userId").lean();
      const online = await presence().onlineAmong(members.map((m) => m.userId.toString()));
      callback([...online]);
    });

    // "X is typing…", sent to the other members of the conversation.
    let lastTyping = 0;
    socket.on("typing", async (payload) => {
      const conversationId = payload?.conversationId;
      const now = Date.now();
      if (typeof conversationId !== "string" || !/^[a-f0-9]{24}$/i.test(conversationId)) return;
      if (now - lastTyping < TYPING_THROTTLE_MS) return;
      lastTyping = now;
      const members = await ConversationMember.find({ conversationId }).select("userId").lean();
      const ids = members.map((m) => m.userId.toString());
      if (!ids.includes(userId)) return; // not your conversation
      emitToUsers(
        ids.filter((id) => id !== userId),
        "typing",
        { conversationId, userId, fullName: user.fullName },
      );
    });

    socket.on("disconnect", async () => {
      if (await presence().remove(userId, socket.id)) {
        if (workspaceId) emitToWorkspace(workspaceId, "presence:update", { userId, online: false });
      }
    });
  });

  setRealtimeServer(io as unknown as Server);
  return io;
};
