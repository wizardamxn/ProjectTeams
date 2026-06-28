import { Queue } from "bullmq";
import connection from "./connection.js";

const ragQueue = new Queue("rag-processing", { connection });

export default ragQueue;
