import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { parseCookie } from "cookie";
import { config } from "../config.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { AUTH_COOKIE, getUserFromToken } from "../middleware/auth.js";
import type { UserDoc } from "../models/user.js";
import { chatService } from "../modules/chat/chat.service.js";
import { usersService } from "../modules/users/users.service.js";
import { workspacesService } from "../modules/workspaces/workspaces.service.js";
import { presence } from "./presence.js";

interface SocketData {
  user: UserDoc;
  chatRoom?: string;
}

type Target = { targetUserId?: string } | undefined;

interface ClientEvents {
  joinChat: (payload: Target) => void;
  checkOnlineStatus: (payload: Target, callback: (online: boolean) => void) => void;
  sendMessage: (payload: (Target & { text?: string }) | undefined) => void;
}

interface ServerEvents {
  error: (message: string) => void;
  messageReceived: (event: Awaited<ReturnType<typeof chatService.send>>) => void;
}

const publicMessage = (err: unknown, fallback: string) => (err instanceof AppError ? err.message : fallback);

export const initializeSocket = (server: HttpServer) => {
  const io = new Server<ClientEvents, ServerEvents, Record<string, never>, SocketData>(server, {
    cors: { origin: config.CORS_ORIGINS, credentials: true },
    maxHttpBufferSize: 64 * 1024,
  });

  // Every socket must carry a valid session cookie. Identity comes from here,
  // never from event payloads.
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

  io.on("connection", (socket) => {
    const { user } = socket.data;
    const userId = user._id.toString();
    presence.add(userId, socket.id);

    // Membership is re-checked on every event, so removing someone from a
    // workspace takes effect immediately, even on an open socket.
    const context = async () => {
      const ctx = await workspacesService.resolveActive(user);
      if (!ctx) throw new AppError(409, "Create or join a workspace first", "no_workspace");
      return ctx;
    };

    socket.on("joinChat", async (payload) => {
      const targetUserId = payload?.targetUserId;
      try {
        const chat = await chatService.openWith(await context(), targetUserId);
        const room = chat._id.toString();
        // One open conversation per socket: leave the previous one.
        if (socket.data.chatRoom && socket.data.chatRoom !== room) socket.leave(socket.data.chatRoom);
        socket.data.chatRoom = room;
        socket.join(room);
      } catch (err) {
        socket.emit("error", publicMessage(err, "Cannot open this chat"));
      }
    });

    socket.on("checkOnlineStatus", async (payload, callback) => {
      if (typeof callback !== "function") return;
      const teammate = await context()
        .then((ctx) => usersService.findTeammate(ctx, payload?.targetUserId))
        .catch(() => null);
      callback(teammate ? presence.isOnline(teammate._id.toString()) : false);
    });

    socket.on("sendMessage", async (payload) => {
      try {
        const event = await chatService.send(await context(), payload?.targetUserId, payload?.text);
        io.to(event.chatId).emit("messageReceived", event);
      } catch (err) {
        if (!(err instanceof AppError)) logger.error({ err, userId }, "sendMessage failed");
        socket.emit("error", publicMessage(err, "Message could not be sent"));
      }
    });

    socket.on("disconnect", () => presence.remove(userId, socket.id));
  });

  return io;
};
