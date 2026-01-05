import { Server } from "socket.io";
import { findOrCreateChat } from "./chat.js";


//ISONLINE
const onlineUsers = new Map();


const initializeSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "http://13.60.201.119",
            credentials: true,
        }
    })
    io.on('connection', async (socket) => {
        socket.on('joinChat', async ({ userId, targetUserId }) => {
            const chat = await findOrCreateChat(userId, targetUserId);
            // FIX 1: Explicitly convert ObjectId to string
            socket.join(chat._id.toString());
        });
        socket.on('isOnline', async ({ userId }) => {
            try {
                onlineUsers.set(userId, socket.id)

                console.log("User online:", userId);
                console.log("Online users:", onlineUsers);
            } catch (error) {
                console.log(error)
            }
        })
        socket.on("checkOnlineStatus", ({ targetUserId }, callback) => {
            const isOnline = onlineUsers.has(targetUserId);
            callback(isOnline);
        });

        socket.on("sendMessage", async (data) => {
            try {
                const { senderName, userId, targetUserId, text } = data;
                console.log("SEND MESSAGE PAYLOAD:", {
                    senderName,
                    userId,
                    targetUserId,
                    text,
                });

                const timestamp = new Date()
                const chat = await findOrCreateChat(userId, targetUserId);

                const message = {
                    senderId: userId,
                    senderName,
                    text,
                    timestamp
                };

                chat.messages.push(message);
                await chat.save();

                io.to(chat._id.toString()).emit("messageReceived", {
                    chatId: chat._id,
                    message,
                });
            } catch (err) {
                console.error("Send message error:", err);
                socket.emit("error", "Message could not be sent");
            }
        });


        socket.on('disconnect', () => {
            for (const [userId, socketId] of onlineUsers.entries()) {
                if (socketId === socket.id) {
                    onlineUsers.delete(userId);
                    console.log("User offline:", userId);
                    break;
                }
            }
        });
    });
}





export default initializeSocket