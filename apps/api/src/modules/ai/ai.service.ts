import { generate } from "../../lib/ai.js";
import { knowledgeService } from "../knowledge/knowledge.service.js";

const SUMMARIZE_PROMPT = `
You are a text summarizer.
Summarize the text you receive in two concise sentences.
Return only the summary. Do not say "here is a summary".
Highlight relevant phrases in bold.`;

const TAGS_PROMPT = `
You are a keyword extraction tool.
Return 5 to 7 relevant tags for the text as a JSON array of strings, e.g. ["React", "Web Dev", "API"].
Return only the JSON array: no other text, no markdown.`;

const IMPROVE_PROMPT = `
You are a professional editor and proofreader.
Correct grammar, spelling and punctuation, and smooth the sentence flow,
strictly keeping the original meaning and tone.
Return ONLY the corrected text, with no conversational filler.`;

const ASK_PROMPT = `
You answer questions using ONLY the provided context.
If the answer is not in the context, say you don't know. Do not use outside knowledge.
Cite the context number(s) you used, e.g. "[1]".`;

/** Models sometimes wrap JSON in code fences or answer with a plain list. */
export const parseTags = (raw: string): string[] => {
  const cleaned = raw.replace(/```(?:json)?/g, "").trim();
  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed.filter((t): t is string => typeof t === "string");
  } catch {
    /* fall through to comma split */
  }
  return cleaned
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((t) => t.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
};

export const aiService = {
  summarize: (content: string) => generate({ system: SUMMARIZE_PROMPT, prompt: content }),

  async generateTags(content: string) {
    return parseTags(await generate({ system: TAGS_PROMPT, prompt: content })).slice(0, 10);
  },

  improveWriting: (content: string) => generate({ system: IMPROVE_PROMPT, prompt: content }),

  async askDocs(teamId: string, question: string) {
    const chunks = await knowledgeService.search(teamId, question, 5);
    if (chunks.length === 0) {
      return { answer: "I don't have any documents to answer that from yet.", sources: [] };
    }

    const context = chunks.map((c, i) => `[${i + 1}] ${c.text}`).join("\n\n");
    const answer = await generate({
      system: ASK_PROMPT,
      prompt: `Context:\n${context}\n\nQuestion: ${question}`,
    });

    return {
      answer,
      sources: chunks.map((c) => ({ documentId: c.documentId, score: c.score })),
    };
  },
};
