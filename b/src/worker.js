import "dotenv/config";
import dns from "node:dns";
import connectDB from "./database/database.js";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

connectDB().then(async () => {
  const { default: ragWorker } = await import("./queues/ragWorker.js");
  console.log("RAG worker listening for jobs on 'rag-processing' queue");

  process.on("SIGTERM", async () => {
    await ragWorker.close();
    process.exit(0);
  });
});
