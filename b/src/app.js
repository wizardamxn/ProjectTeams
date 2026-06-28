import dns from "node:dns";
import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

import connectDB from "./database/database.js";
import authRouter from "./Routes/auth.js";
import docRouter from "./Routes/doc.js";
import profileRouter from "./Routes/profile.js";
import aiRouter from "./Routes/ai.js";
import initializeSocket from "./utils/socket.js";
import chatRouter from "./Routes/chat.js";
import uploadRouter from "./Routes/upload.js";

const app = express();

/* ========== MIDDLEWARE ========== */
app.use(cookieParser());
app.use(
  cors({
   origin: [
    "http://13.60.201.119",
    "http://localhost:8080",
    "http://localhost:8081",
    "http://localhost:5173",
    "http://localhost:4173",
  ],
    credentials: true,
  })
);
app.use(express.json());

/* ========== SERVER + SOCKET ========== */
const server = http.createServer(app);
initializeSocket(server);

/* ========== ROUTES ========== */
app.use("/api/auth", authRouter);
app.use("/api/doc", docRouter);
app.use("/api/profile", profileRouter);
app.use("/api/chat", chatRouter);
app.use("/api/ai", aiRouter);
app.use("/api/upload", uploadRouter);

/* ========== DB + START SERVER ========== */
connectDB().then(() => {
  server.listen(2222, () => {
    console.log("🚀 Server started on port 2222");
  });
});
