import "dotenv/config";
import { createServer } from "node:http";
import cors, { type CorsOptions } from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import type { ClientToServerEvents, ServerToClientEvents } from "@motionmeet/shared";
import authRoutes from "./routes/authRoutes.js";
import equipmentRouter from "./routes/equipmentRoutes.js";
import exerciseRouter from "./routes/exerciseRoutes.js";
import locationRouter from "./routes/locationRoutes.js";
import mediaRouter from "./routes/mediaRoutes.js";
import measurementRouter from "./routes/measurementRoutes.js";
import nearbyRouter from "./routes/nearbyRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import muscleGroupRouter from "./routes/muscleGroupRoutes.js";
import planRouter from "./routes/planRoutes.js";
import postRouter from "./routes/postRoutes.js";
import rbacRouter from "./routes/rbacRoutes.js";
import routineRouter from "./routes/routineRoutes.js";
import storyRouter from "./routes/storyRoutes.js";
import userRouter from "./routes/userRoutes.js";
import workoutRouter from "./routes/workoutRoutes.js";
import { checkDatabaseHealth, connectDatabase, disconnectDatabase, isDatabaseReady } from "./configs/database.js";
import { isDevelopmentOrigin, loadEnvironment } from "./configs/environment.js";
import { createRateLimitStore, disconnectRedis, getRedisStatus, initializeRedis, onRedisReady } from "./configs/redis.js";
import { migrateToLatest } from "./db/migrator.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";
import { requestContext } from "./middlewares/requestContext.js";
import { rejectUnsupportedApiContentType } from "./middlewares/browserSecurity.js";
import { handleSocketConnection } from "./realtime/socketHandlers.js";
import { setSocketServer, userSockets, type SocketData } from "./realtime/socketRegistry.js";
import { ensureApplicationData } from "./services/bootstrapService.js";
import { assertDatabaseContract } from "./services/databaseMigrationService.js";
import { detectGeometrySupport } from "./services/locationGeometry.js";
import * as userService from "./services/userService.js";
import { verifyAccessToken } from "./utils/authTokens.js";
import { logger, safeErrorMetadata } from "./utils/logger.js";
import { isUserId } from "./utils/validation.js";
import { initCronJobs } from "./workers/cronJobs.js";

const environment = loadEnvironment();
const configuredOrigins = environment.corsOrigins;
const isAllowedOrigin = (origin?: string): boolean => !origin || configuredOrigins.includes(origin.replace(/\/$/, "")) || (environment.nodeEnv !== "production" && isDevelopmentOrigin(origin));
const corsOptions: CorsOptions = {
  allowedHeaders: ["Authorization", "Content-Type", "Idempotency-Key", "X-Client-Platform", "X-CSRF-Protection", "X-Request-Id"],
  credentials: true,
  exposedHeaders: ["Retry-After", "X-Request-Id"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  optionsSuccessStatus: 200,
  origin(origin, callback) { if (isAllowedOrigin(origin)) callback(null, true); else callback(Object.assign(new Error("Origin is not allowed by CORS"), { status: 403 })); },
};

let redis: Awaited<ReturnType<typeof initializeRedis>>;
const startupBegan = Date.now();
// Startup phases are timed so a slow boot can be attributed to a single step
// instead of guessing which dependency is stalling.
const timedPhase = async <T>(name: string, run: () => Promise<T>): Promise<T> => {
  const began = Date.now();
  try {
    return await run();
  } finally {
    logger.info("startup_phase", { phase: name, ms: Date.now() - began });
  }
};
try {
  await timedPhase("database", connectDatabase);
  if (process.env.RUN_MIGRATIONS !== "false") await timedPhase("migrations", migrateToLatest);
  // assertDatabaseContract and initializeRedis are independent of each other;
  // run them concurrently to reduce startup latency.
  const [, , redisResult] = await Promise.all([
    timedPhase("database_contract", assertDatabaseContract),
    // Decides whether proximity queries use PostGIS or the portable
    // bounding-box path; both read the same columns, so this only picks SQL.
    timedPhase("location_geometry", detectGeometrySupport),
    timedPhase("redis", initializeRedis),
  ]);
  redis = redisResult;
  // ensureApplicationData requires the DB contract to pass first,
  // but does not depend on Redis.
  await timedPhase("application_data", ensureApplicationData);
} catch (error: unknown) {
  logger.error("server_startup_failed", safeErrorMetadata(error));
  if (isDatabaseReady()) await disconnectDatabase().catch(() => undefined);
  process.exit(1);
}


const app = express();
app.disable("x-powered-by");
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, { cors: corsOptions });
setSocketServer(io);
if (redis) io.adapter(createAdapter(redis.publisher, redis.subscriber));
// Booting no longer waits for Redis, so a connection established later still
// has to replace the in-memory adapter for multi-instance fan-out.
else onRedisReady((clients) => io.adapter(createAdapter(clients.publisher, clients.subscriber)));

app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(requestContext);
app.use(cors(corsOptions));
app.use("/api", rejectUnsupportedApiContentType);
app.use(express.json({ limit: "500kb", strict: true }));
const configuredGlobalLimit = Number.parseInt(process.env.GLOBAL_RATE_LIMIT_PER_15_MIN ?? "", 10);
app.use("/api", rateLimit({ windowMs: 900_000, limit: Number.isFinite(configuredGlobalLimit) ? Math.min(Math.max(configuredGlobalLimit, 100), 10_000) : 1_000, standardHeaders: true, legacyHeaders: false, store: createRateLimitStore("global"), message: { success: false, message: "Too many requests; please try again later" } }));

app.get("/", (_request, response) => { response.send("Server is running"); });
app.get("/health/live", (_request, response) => { response.json({ status: "ok", uptimeSeconds: Math.floor(process.uptime()) }); });
app.get("/health/ready", async (_request, response) => {
  const databaseReady = await checkDatabaseHealth(); const redisStatus = getRedisStatus(); const ready = databaseReady;
  response.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not-ready", database: databaseReady ? "ready" : "not-ready", redis: redisStatus, degraded: redisStatus === "not-ready", capabilities: { mediaUploads: environment.mediaUploadsEnabled ? "configured" : "disabled", email: environment.emailEnabled ? "configured" : "disabled", backgroundJobs: environment.scheduledJobsEnabled ? "enabled" : "disabled" } });
});

app.use("/api/auth", authRoutes); app.use("/api/user", userRouter); app.use("/api/post", postRouter); app.use("/api/story", storyRouter);
app.use("/api/message", messageRouter); app.use("/api/exercise", exerciseRouter); app.use("/api/routine", routineRouter); app.use("/api/workout", workoutRouter);
app.use("/api/plans", planRouter); app.use("/api/admin", rbacRouter); app.use("/api/muscle-groups", muscleGroupRouter); app.use("/api/equipment", equipmentRouter); app.use("/api/media", mediaRouter); app.use("/api/measurements", measurementRouter);
app.use("/api/locations", locationRouter); app.use("/api/nearby", nearbyRouter);
app.use(notFoundHandler); app.use(errorHandler);

io.use(async (socket, next) => {
  try {
    const token: unknown = socket.handshake.auth?.token;
    if (typeof token !== "string" || !token || token.length > 10_000) return next(new Error("Authentication required"));
    const payload = verifyAccessToken(token); if (!isUserId(payload.id)) return next(new Error("Invalid user identity"));
    const user = await userService.getUserById(payload.id); if (!user) return next(new Error("User not found"));
    socket.data.userId = payload.id; socket.data.user = user; next();
  } catch (error: unknown) { logger.warn("socket_authentication_failed", safeErrorMetadata(error)); next(new Error("Authentication failed")); }
});
io.on("connection", (socket) => { void handleSocketConnection(socket).catch((error: unknown) => { logger.error("socket_initialization_failed", safeErrorMetadata(error)); socket.disconnect(true); }); });

export { app, io, userSockets };
const cronTasks = initCronJobs();
let shuttingDown = false;
const shutdown = async (signal: string, exitCode = 0): Promise<void> => {
  if (shuttingDown) return; shuttingDown = true; console.log(`${signal} received; shutting down`);
  const forceExitTimer = setTimeout(() => process.exit(1), 10_000); forceExitTimer.unref();
  cronTasks.forEach((task) => task.stop());
  await new Promise<void>((resolve) => io.close(() => resolve()));
  if (httpServer.listening) await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await Promise.allSettled([disconnectDatabase(), disconnectRedis()]);
  clearTimeout(forceExitTimer); process.exit(exitCode);
};
process.once("SIGTERM", () => { void shutdown("SIGTERM"); }); process.once("SIGINT", () => { void shutdown("SIGINT"); });
process.once("uncaughtException", (error) => { logger.error("uncaught_exception", safeErrorMetadata(error)); void shutdown("uncaughtException", 1); });
process.once("unhandledRejection", (error) => { logger.error("unhandled_rejection", safeErrorMetadata(error)); void shutdown("unhandledRejection", 1); });

try {
  httpServer.listen(environment.port, "0.0.0.0", () => { console.log(`Server + Socket.io running on port ${environment.port} (startup ${Date.now() - startupBegan}ms)`); });
  httpServer.on("error", (error: NodeJS.ErrnoException) => { logger.error(error.code === "EADDRINUSE" ? "http_port_in_use" : "http_server_error", { port: environment.port, ...safeErrorMetadata(error) }); void shutdown("httpServerError", 1); });
} catch (error: unknown) {
  logger.error("server_startup_failed", safeErrorMetadata(error));
  if (isDatabaseReady()) await disconnectDatabase().catch(() => undefined);
  process.exit(1);
}
