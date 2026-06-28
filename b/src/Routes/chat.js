import express from "express";
import { findOrCreateChat } from "../utils/chat.js";
const chatRouter = express.Router();

chatRouter.get("/chat/:userId/:targetUserId", async (req, res) => {
  try {
    const { userId, targetUserId } = req.params;

    const chat = await findOrCreateChat(userId, targetUserId);

    res.status(200).json(chat);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
});

export default chatRouter;
