import express from "express";
import authorised from "../middlewares/authorised.js";
import { findTeammate } from "../utils/auth.js";
import { findOrCreateChat } from "../utils/chat.js";

const chatRouter = express.Router();

// Chat history between the logged-in user and a teammate.
// The caller is always one side of the chat; it can never be chosen by the client.
chatRouter.get("/with/:targetUserId", authorised, async (req, res, next) => {
  try {
    const teammate = await findTeammate(req.user, req.params.targetUserId);
    if (!teammate) return res.status(404).json({ message: "Teammate not found" });

    const chat = await findOrCreateChat(req.user._id, teammate._id);
    res.status(200).json(chat);
  } catch (err) {
    next(err);
  }
});

export default chatRouter;
