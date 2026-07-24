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
import mediaRouter from "./routes/mediaRoutes.js";
import * as userService from "./services/userService.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";
import { setSocketServer, userSockets } from "./realtime/socketRegistry.js";
import { isUserId } from "./utils/validation.js";
import { verifyAccessToken } from "./utils/authTokens.js";
import { validateEnvironment } from "./configs/validateEnv.js";
import { createAdapter } from "@socket.io/redis-adapter";
import {
  createRateLimitStore,
  disconnectRedis,
  initializeRedis,
  isRedisReady,
} from "./configs/redis.js";
import mongoose from "mongoose";
import { requestContext } from "./middlewares/requestContext.js";

const app = express();
const httpServer = createServer(app);
const isProduction = process.env.NODE_ENV === "production";
validateEnvironment();

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
app.use(requestContext);
app.use(cors(corsOptions));
app.use(express.json({ limit: "100kb", strict: true }));


const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("global"),
  message: { success: false, message: "Too many requests; please try again later" },
});

app.use("/api", globalLimiter);

app.get("/", (req, res) => res.send("Server is running"));
app.get("/health/live", (req, res) => {
  res.json({ status: "ok", uptimeSeconds: Math.floor(process.uptime()) });
});
app.get("/health/ready", (req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  const redisReady = isRedisReady();
  const ready = databaseReady && redisReady;
  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "not-ready",
    database: databaseReady ? "ready" : "not-ready",
    redis: redisReady ? "ready" : "not-ready",
  });
});
if (!isProduction) {
  app.use("/dataset", express.static(path.join(__dirname, "../../../exercises-dataset-main")));
}
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
app.use("/api/media", mediaRouter);
app.use(notFoundHandler);
app.use(errorHandler);

import { handleSocketConnection } from "./realtime/socketHandlers.js";

const io = new Server(httpServer, { cors: corsOptions });
setSocketServer(io);

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string" || token.length === 0 || token.length > 10000) {
      return next(new Error("Authentication required"));
    }

    const payload = verifyAccessToken(token);
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
  void handleSocketConnection(socket).catch((error) => {
    console.error("Socket initialization failed:", error.message);
    socket.disconnect(true);
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
  await disconnectRedis().catch((error) => console.error("Redis shutdown error:", error));
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
  const redis = await initializeRedis();
  if (redis) {
    io.adapter(createAdapter(redis.publisher, redis.subscriber));
  }
  initCronJobs();
  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Server + Socket.io running on port ${port}`);
  });
} catch (error) {
  console.error("Server startup failed:", error.message);
  await disconnectDB().catch(() => {});
  process.exit(1);
}
