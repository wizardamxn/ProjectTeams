import "dotenv/config";
import dns from "node:dns";
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import multer from "multer";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

import connectDB from "./database/database.js";
import authRouter from "./Routes/auth.js";
import docRouter from "./Routes/doc.js";
import profileRouter from "./Routes/profile.js";
import aiRouter from "./Routes/ai.js";
import initializeSocket from "./utils/socket.js";
import chatRouter from "./Routes/chat.js";
import uploadRouter from "./Routes/upload.js";

const PORT = Number(process.env.PORT || 2222);

for (const key of ["MONGO_URI", "JWT_KEY"]) {
  if (!process.env[key]) {
    console.error(`Missing required env var ${key}`);
    process.exit(1);
  }
}

const app = express();

// Behind Nginx (and Cloudflare in prod). Needed so rate limits see the real
// client IP instead of the proxy's. Set TRUST_PROXY to the number of proxy hops.
app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 1));

/* ========== MIDDLEWARE ========== */
app.use(helmet());
app.use(cookieParser());
app.use(
  cors({
    // Production is same-origin (nginx proxies /api), so no public origin is
    // needed here. These are for local dev (frontend hitting the backend directly).
    origin: [
      "http://localhost:8080",
      "http://localhost:8081",
      "http://localhost:5173",
      "http://localhost:4173",
    ],
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));

/* ========== SERVER + SOCKET ========== */
const server = http.createServer(app);
initializeSocket(server);

/* ========== ROUTES ========== */
app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/doc", docRouter);
app.use("/api/profile", profileRouter);
app.use("/api/chat", chatRouter);
app.use("/api/ai", aiRouter);
app.use("/api/upload", uploadRouter);

app.use("/api", (req, res) => res.status(404).json({ message: "Not found" }));

/* ========== ERRORS ========== */
// One place that turns thrown errors into JSON. Never leaks stack traces.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "File is larger than 20 MB" : err.message;
    return res.status(400).json({ message });
  }
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ message: err.message });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Request is too large" });
  }
  console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(500).json({ message: "Something went wrong" });
});

/* ========== DB + START SERVER ========== */
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Server started on port ${PORT}`);
  });
});
