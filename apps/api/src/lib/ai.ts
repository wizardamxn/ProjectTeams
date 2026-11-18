import { generateText, embedMany } from "ai";
import { google } from "@ai-sdk/google";
import { config } from "../config.js";

// The only place that talks to the model provider. Swapping providers or
// models means changing this file (or AI_MODEL / EMBEDDING_MODEL).

const textModel = google(config.AI_MODEL);
const embeddingModel = google.textEmbeddingModel(config.EMBEDDING_MODEL);

const EMBED_BATCH_SIZE = 100;

export const generate = async ({ system, prompt }: { system: string; prompt: string }) => {
  const { text } = await generateText({ model: textModel, system, prompt });
  return text;
};

/** Embeds any number of texts, in batches the provider accepts. */
export const embed = async (values: string[]): Promise<number[][]> => {
  const out: number[][] = [];
  for (let i = 0; i < values.length; i += EMBED_BATCH_SIZE) {
    const { embeddings } = await embedMany({
      model: embeddingModel,
      values: values.slice(i, i + EMBED_BATCH_SIZE),
    });
    out.push(...embeddings);
  }
  return out;
};
