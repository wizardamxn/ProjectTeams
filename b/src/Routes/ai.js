import "dotenv/config"; // Loads .env immediately
import express from "express";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import authorised from "../middlewares/authorised.js"; // Note: ESM often requires .js extensions
import { searchChunks } from "../utils/searchChunks.js";

const aiRouter = express.Router();

// Define the model
const model = google("gemini-2.5-flash");

// AI function
const useAI = async ({ model, prompt, system }) => {
  const { text } = await generateText({
    model,
    prompt,
    system,
  });
  return text;
};

// ==========================================
// 1. SUMMARIZE API
// ==========================================
aiRouter.post("/summarize", async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: "Missing content" });

    const summary = await useAI({
      model,
      prompt: content,
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

    return res.json({ summary });
  } catch (err) {
    console.error("Summarize error:", err);
    return res.status(500).json({ error: "Failed to summarize text." });
  }
});

// ==========================================
// 2. GENERATE TAGS API
// ==========================================
aiRouter.post("/generate-tags", async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: "Missing content" });

    const tags = await useAI({
      model,
      prompt: content,
      system: `
        You are a keyword extraction tool.
        Analyze the text and generate a list of 5 to 7 relevant tags or keywords.
        Return them as a standard JSON array of strings (e.g., ["React", "Web Dev", "API"]).
        Do not include any other text or markdown formatting.
      `,
    });

    // Helper to ensure we send back a real array
    let parsedTags;
    try {
        // Remove markdown code blocks if AI adds them (e.g. ```json ... ```)
        const cleanTags = tags.replace(/```json|```/g, "").trim();
        parsedTags = JSON.parse(cleanTags);
    } catch (e) {
        parsedTags = tags.split(',').map(tag => tag.trim());
    }

    return res.json({ tags: parsedTags });
  } catch (err) {
    console.error("Tags error:", err);
    return res.status(500).json({ error: "Failed to generate tags." });
  }
});

// ==========================================
// 3. IMPROVE GRAMMAR API
// ==========================================
aiRouter.post("/improve-writing", async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: "Missing content" });

    const improvedText = await useAI({
      model,
      prompt: content,
      system: `
        You are a professional editor and proofreader.
        Review the provided text and correct any grammar, spelling, or punctuation errors.
        Refine the sentence structure for better flow, but strictly maintain the original meaning and tone.
        Return ONLY the corrected text. Do not add conversational filler.
      `,
    });

    return res.json({ improvedText });
  } catch (err) {
    console.error("Grammar error:", err);
    return res.status(500).json({ error: "Failed to improve grammar." });
  }
});

// ==========================================
// 4. ASK DOCS API (RAG)
// ==========================================
aiRouter.post("/ask-docs", authorised, async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: "Missing question" });

    const teamId = req.user.teamCode;
    const chunks = await searchChunks(question, teamId, 5);

    if (chunks.length === 0) {
      return res.json({
        answer: "I don't have any documents to answer that from yet.",
        sources: [],
      });
    }

    const context = chunks
      .map((chunk, i) => `[${i + 1}] ${chunk.text}`)
      .join("\n\n");

    const answer = await useAI({
      model,
      prompt: `Context:\n${context}\n\nQuestion: ${question}`,
      system: `
        You are a helpful assistant that answers questions using ONLY the provided context.
        If the answer cannot be found in the context, say you don't know. Do not use outside knowledge.
        Cite the context number(s) you used, e.g. "[1]".
      `,
    });

    return res.json({
      answer,
      sources: chunks.map((chunk) => ({
        documentId: chunk.documentId,
        score: chunk.score,
      })),
    });
  } catch (err) {
    console.error("Ask-docs error:", err);
    return res.status(500).json({ error: "Failed to answer question." });
  }
});

export default aiRouter;