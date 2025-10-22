require("dotenv").config(); // if you're using .env
const express = require("express");
const { generateText } = require("ai");
const { google } = require("@ai-sdk/google"); // ✅ changed this to require()
const authorised = require("../middlewares/authorised");

const aiRouter = express.Router();

// Define the model
const model = google("gemini-2.5-flash"); // ✅ gemini-2.0-flash-lite or gemini-2.5-flash depending on support

// AI function
const useAI = async ({ model, prompt }) => {
  const { text } = await generateText({
    model,
    prompt,
    system: `
      You are a text summarizer.
      Summarize the text you receive.
      Be concise.
      Return only the summary.
      Do not use the phrase "here is a summary".
      Highlight relevant phrases in bold.
      The summary should be two sentences long.
    `,
  });
  return text;
};

// POST route
aiRouter.post("/summarize", async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Missing 'content' in request body." });
    }

    const summary = await useAI({ model, prompt: content });

    return res.json({ summary });
  } catch (err) {
    console.error("AI summarization error:", err);
    return res.status(500).json({ error: "Failed to summarize text." });
  }
});

module.exports = aiRouter;
