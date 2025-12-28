import express from "express";
import { findOrCreateChat } from "../utils/chat.js";
import User from "../models/user.js";
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
chatRouter.get('/user/:targetUserId', async (req, res) => {
  try {
    const { targetUserId } = req.params
    const targetUser = await User.findById(targetUserId)
    res.status(200).send(targetUser)
  } catch (error) {
    res.status(404).send("Can't fetch target user")
  }
})
export default chatRouter;
