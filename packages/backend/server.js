import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import "dotenv/config";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import jwt from "jsonwebtoken";

import connectDB, { disconnectDB } from "./configs/db.js";
import userRouter from "./routes/userRoutes.js";
import postRouter from "./routes/postRoutes.js";
import storyRouter from "./routes/storyRoutes.js";
import messageRouter from "./routes/messageRoutes.js";


import authRoutes from "./routes/authRoutes.js";
import { initCronJobs } from "./workers/cronJobs.js";
import exerciseRouter from "./routes/exerciseRoutes.js";
import routineRouter from "./routes/routineRoutes.js";
import workoutRouter from "./routes/workoutRoutes.js";
import planRouter from "./routes/planRoutes.js";
import rbacRouter from "./routes/rbacRoutes.js";
import muscleGroupRouter from "./routes/muscleGroupRoutes.js";
import equipmentRouter from "./routes/equipmentRoutes.js";
import * as messageService from "./services/messageService.js";
import * as userService from "./services/userService.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";
import { emitToUser, setSocketServer, userSockets } from "./realtime/socketRegistry.js";
import { isUserId } from "./utils/validation.js";

const app = express();
const httpServer = createServer(app);
const isProduction = process.env.NODE_ENV === "production";

const configuredOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true; // Native clients and server-to-server requests.
  const normalizedOrigin = origin.replace(/\/$/, "");
  if (configuredOrigins.includes(normalizedOrigin)) return true;
  return !isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin);
};

const corsOptions = {
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    const error = Object.assign(new Error("Origin is not allowed by CORS"), { status: 403 });
    return callback(error);
  },
};

if (isProduction) app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: "100kb", strict: true }));


const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests; please try again later" },
});

app.use("/api", globalLimiter);

app.get("/", (req, res) => res.send("Server is running"));
app.use("/dataset", express.static(path.join(__dirname, "../../../exercises-dataset-main")));
app.use("/api/auth", authRoutes);
app.use("/api/user", userRouter);
app.use("/api/post", postRouter);
app.use("/api/story", storyRouter);
app.use("/api/message", messageRouter);
app.use("/api/exercise", exerciseRouter);
app.use("/api/routine", routineRouter);
app.use("/api/workout", workoutRouter);
app.use("/api/plans", planRouter);
app.use("/api/admin", rbacRouter);
app.use("/api/muscle-groups", muscleGroupRouter);
app.use("/api/equipment", equipmentRouter);
app.use(notFoundHandler);
app.use(errorHandler);

const io = new Server(httpServer, { cors: corsOptions });
setSocketServer(io);

const emitPresenceToConnections = (user, eventName, payload) => {
  user.connections?.forEach((connectionId) => {
    emitToUser(connectionId.toString(), eventName, payload);
  });
};

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string" || token.length === 0 || token.length > 10000) {
      return next(new Error("Authentication required"));
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!isUserId(payload.id)) return next(new Error("Invalid user identity"));

    const user = await userService.getUserById(payload.id);
    if (!user) return next(new Error("User not found"));
    socket.data.userId = payload.id;
    socket.data.user = user;
    return next();
  } catch (error) {
    console.warn("Socket authentication failed:", error.message);
    return next(new Error("Authentication failed"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.data.userId;
  const wasOffline = !userSockets.get(userId)?.size;
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId).add(socket.id);
  socket.emit(
    "online_users",
    (socket.data.user.connections || [])
      .map((connectionId) => connectionId.toString())
      .filter((connectionId) => userSockets.has(connectionId))
  );
  if (wasOffline) emitPresenceToConnections(socket.data.user, "user_online", { userId });

  const recentMessageTimes = [];
  socket.on("send_message", async (payload = {}) => {
    try {
      const recipientId = payload.to_user_id;
      const text = typeof payload.text === "string" ? payload.text.trim() : "";
      if (!isUserId(recipientId) || recipientId === userId || !text || text.length > 2000) {
        return socket.emit("message_error", { message: "Invalid message" });
      }

      const now = Date.now();
      while (recentMessageTimes.length && recentMessageTimes[0] < now - 60_000) recentMessageTimes.shift();
      if (recentMessageTimes.length >= 30) {
        return socket.emit("message_error", { message: "Message rate limit reached" });
      }
      recentMessageTimes.push(now);

      const sender = /** @type {any} */ (await userService.getUserById(userId));
      const recipientExists = await userService.userExists(recipientId);
      const canMessageAnyone = sender?.role === "superadmin" || sender?.plan?.features?.can_message_anyone;
      const isConnected = sender?.connections?.includes(recipientId);
      if (!sender || !recipientExists || (!canMessageAnyone && !isConnected)) {
        return socket.emit("message_error", { message: "You cannot message this user" });
      }

      const populated = await messageService.createMessage({
        from_user_id: userId,
        to_user_id: recipientId,
        text,
        message_type: "text",
        media_url: "",
        seen: false,
      });

      emitToUser(recipientId, "message_received", populated);
      emitToUser(userId, "message_sent", populated);
    } catch (error) {
      console.error("Socket message error:", error);
      socket.emit("message_error", { message: "Message could not be sent" });
    }
  });

  const emitTyping = async (eventName, payload = {}) => {
    const recipientId = payload.to_user_id;
    if (!isUserId(recipientId) || recipientId === userId) return;

    try {
      const sender = /** @type {any} */ (await userService.getUserById(userId));
      const canMessageAnyone = sender?.role === "superadmin" || sender?.plan?.features?.can_message_anyone;
      const isConnected = sender?.connections?.includes(recipientId);
      if (sender && (canMessageAnyone || isConnected)) {
        emitToUser(recipientId, eventName, { from_user_id: userId });
      }
    } catch (error) {
      console.error("Socket typing event error:", error.message);
    }
  };
  socket.on("typing_start", (payload) => void emitTyping("typing_start", payload));
  socket.on("typing_stop", (payload) => void emitTyping("typing_stop", payload));

  socket.on("disconnect", () => {
    userSockets.get(userId)?.delete(socket.id);
    if (!userSockets.get(userId)?.size) {
      userSockets.delete(userId);
      emitPresenceToConnections(socket.data.user, "user_offline", { userId });
    }
  });
});

export { app, io, userSockets };

const port = Number(process.env.PORT) || 4000;
let shuttingDown = false;

const shutdown = async (signal, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; shutting down`);

  const forceExitTimer = setTimeout(() => process.exit(1), 10_000);
  forceExitTimer.unref();

  await new Promise((resolve) => io.close(resolve));
  await disconnectDB().catch((error) => console.error("Database shutdown error:", error));
  clearTimeout(forceExitTimer);
  process.exit(exitCode);
};

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  void shutdown("uncaughtException", 1);
});
process.once("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error);
  void shutdown("unhandledRejection", 1);
});

try {
  await connectDB();
  initCronJobs();
  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Server + Socket.io running on port ${port}`);
  });
} catch (error) {
  console.error("Server startup failed:", error.message);
  await disconnectDB().catch(() => {});
  process.exit(1);
}
