import Chat from "../models/chat.js";


export const findOrCreateChat = async (userId, targetuserId) => {
    const participants = [userId, targetuserId].sort();
    let chat = await Chat.findOne({
        participants: { $all: participants },
    });
    if (!chat) {
        chat = await Chat.create({ participants })
    }
    return chat;
}

