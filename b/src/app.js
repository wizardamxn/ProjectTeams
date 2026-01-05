import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";

import connectDB from "./database/database.js";
import authRouter from "./Routes/auth.js";
import docRouter from "./Routes/doc.js";
import profileRouter from "./Routes/profile.js";
import aiRouter from "./Routes/ai.js";
import initializeSocket from "./utils/socket.js";
import chatRouter from "./Routes/chat.js";

const app = express();

/* ========== MIDDLEWARE ========== */
app.use(cookieParser());
app.use(
  cors({
   origin: "http://13.60.201.119",
    credentials: true,
  })
);
app.use(express.json());

/* ========== SERVER + SOCKET ========== */
const server = http.createServer(app);
initializeSocket(server);

/* ========== ROUTES ========== */
app.use("/", authRouter);
app.use("/", docRouter);
app.use("/", profileRouter);
app.use('/', chatRouter)
app.use("/", aiRouter);

/* ========== DB + START SERVER ========== */
connectDB().then(() => {
  server.listen(2222, () => {
    console.log("🚀 Server started on port 2222");
  });
});
