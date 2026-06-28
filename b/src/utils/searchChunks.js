import RagChunk from "../models/ragChunk.js";
import { embedChunks } from "./embedChunks.js";

export const searchChunks = async (question, teamId, limit = 5) => {
  const [queryVector] = await embedChunks([question]);

  return RagChunk.aggregate([
    {
      $vectorSearch: {
        index: "rag_chunk_vector_index",
        path: "embedding",
        queryVector,
        numCandidates: limit * 10,
        limit,
        filter: { teamId },
      },
    },
    {
      $project: {
        text: 1,
        documentId: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ]);
};
