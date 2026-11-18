import { Server } from "socket.io";
import { parseCookie } from "cookie";
import { getUserFromToken, findTeammate } from "./auth.js";
import { findOrCreateChat } from "./chat.js";

const MAX_MESSAGE_LENGTH = 4000;

// userId -> Set of socket ids (a user can have several tabs open).
const onlineUsers = new Map();

const markOnline = (userId, socketId) => {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socketId);
};

const markOffline = (userId, socketId) => {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) onlineUsers.delete(userId);
};

export const isUserOnline = (userId) => onlineUsers.has(String(userId));

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      // Production is same-origin (nginx proxies /socket.io); these cover local dev.
      origin: [
        "http://localhost:8080",
        "http://localhost:5173",
        "http://localhost:4173",
      ],
      credentials: true,
    },
    maxHttpBufferSize: 64 * 1024,
  });

  // Every socket must carry a valid auth cookie. Identity comes from here,
  // never from event payloads.
  io.use(async (socket, next) => {
    try {
      const cookies = parseCookie(socket.handshake.headers.cookie || "");
      const user = await getUserFromToken(cookies.token);
      if (!user) return next(new Error("unauthorized"));
      socket.data.user = user;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    const userId = user._id.toString();
    markOnline(userId, socket.id);

    socket.on("joinChat", async ({ targetUserId } = {}) => {
      try {
        const teammate = await findTeammate(user, targetUserId);
        if (!teammate) return socket.emit("error", "Cannot open this chat");

        const chat = await findOrCreateChat(user._id, teammate._id);
        const room = chat._id.toString();

        // Only one open conversation per socket: leave the previous one.
        if (socket.data.chatRoom && socket.data.chatRoom !== room) {
          socket.leave(socket.data.chatRoom);
        }
        socket.data.chatRoom = room;
        socket.join(room);
      } catch (err) {
        console.error("joinChat error:", err.message);
        socket.emit("error", "Cannot open this chat");
      }
    });

    socket.on("checkOnlineStatus", async ({ targetUserId } = {}, callback) => {
      if (typeof callback !== "function") return;
      const teammate = await findTeammate(user, targetUserId).catch(() => null);
      callback(teammate ? isUserOnline(teammate._id) : false);
    });

    socket.on("sendMessage", async ({ targetUserId, text } = {}) => {
      try {
        if (typeof text !== "string") return;
        const trimmed = text.trim();
        if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) {
          return socket.emit("error", "Message is empty or too long");
        }

        const teammate = await findTeammate(user, targetUserId);
        if (!teammate) return socket.emit("error", "Message could not be sent");

        const chat = await findOrCreateChat(user._id, teammate._id);
        chat.messages.push({
          senderId: user._id,
          senderName: user.fullName,
          text: trimmed,
        });
        await chat.save();

        const saved = chat.messages[chat.messages.length - 1];
        io.to(chat._id.toString()).emit("messageReceived", {
          chatId: chat._id.toString(),
          message: {
            _id: saved._id,
            senderId: userId,
            senderName: saved.senderName,
            text: saved.text,
            timestamp: saved.createdAt,
          },
        });
      } catch (err) {
        console.error("Send message error:", err.message);
        socket.emit("error", "Message could not be sent");
      }
    });

    socket.on("disconnect", () => {
      markOffline(userId, socket.id);
    });
  });

  return io;
};

export default initializeSocket;
