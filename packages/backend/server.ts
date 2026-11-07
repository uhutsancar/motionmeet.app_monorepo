import "dotenv/config";
import { createServer } from "node:http";
import cors, { type CorsOptions } from "cors";
import express from "express";
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
import notificationRouter from "./routes/notificationRoutes.js";
import postRouter from "./routes/postRoutes.js";
import rbacRouter from "./routes/rbacRoutes.js";
import routineRouter from "./routes/routineRoutes.js";
import shareRouter from "./routes/shareRoutes.js";
import storyRouter from "./routes/storyRoutes.js";
import userRouter from "./routes/userRoutes.js";
import workoutRouter from "./routes/workoutRoutes.js";
import { checkDatabaseHealth, connectDatabase, disconnectDatabase, isDatabaseReady } from "./configs/database.js";
import { isDevelopmentOrigin, loadEnvironment } from "./configs/environment.js";
import { disconnectRedis, getRedisStatus, initializeRedis, onRedisReady } from "./configs/redis.js";
import { migrateToLatest } from "./db/migrator.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";
import { bearerOrClientKey, createLimiter } from "./middlewares/rateLimits.js";
import { requestContext } from "./middlewares/requestContext.js";
import { parseJsonBody, rejectUnsupportedApiContentType } from "./middlewares/browserSecurity.js";
import { answerRetiredBilling, RETIRED_BILLING_PATHS } from "./middlewares/retiredBilling.js";
import { handleSocketConnection } from "./realtime/socketHandlers.js";
import { setSocketServer, type InterServerEvents, type SocketData, bindSocketIdentity } from "./realtime/socketRegistry.js";
import { ensureApplicationData } from "./services/bootstrapService.js";
import { assertDatabaseContract } from "./services/databaseMigrationService.js";
import { detectGeometrySupport } from "./services/locationGeometry.js";
import * as userService from "./services/userService.js";
import { isSessionActive, verifyAccessToken } from "./utils/authTokens.js";
import { errorDiagnostics, logger, safeErrorMetadata } from "./utils/logger.js";
import { isUserId } from "./utils/validation.js";
import { initCronJobs } from "./workers/cronJobs.js";
import { startDirectOutboxRelay } from "./messaging/outboxRelay.js";
import { reportVideoProbeAvailability } from "./services/mediaProbeService.js";
import { startOpsServer } from "./observability/opsServer.js";

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
  // Independent of each other, so they overlap.
  await Promise.all([
    timedPhase("database_contract", assertDatabaseContract),
    // Decides whether proximity queries use PostGIS or the portable
    // bounding-box path; both read the same columns, so this only picks SQL.
    timedPhase("location_geometry", detectGeometrySupport),
  ]);
  // Requires the DB contract to pass first.
  await timedPhase("application_data", ensureApplicationData);
} catch (error: unknown) {
  logger.error("server_startup_failed", errorDiagnostics(error));
  if (isDatabaseReady()) await disconnectDatabase().catch(() => undefined);
  process.exit(1);
}


const app = express();
app.disable("x-powered-by");
const httpServer = createServer(app);
// WebSocket only (WP-19 of the 2026-11 audit). Long-polling needs every
// request of one session to reach the same replica, i.e. sticky sessions at
// the load balancer; a WebSocket is one connection and needs none. Clients
// list "websocket" first, so builds that still also offer polling connect
// the same way. Networks that block WebSockets lose realtime and fall back to
// the REST paths (and to message sync on the next connection).
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, { cors: corsOptions, transports: ["websocket"] });
setSocketServer(io);
// Fires immediately if the connection already won the race, otherwise when it
// lands - either way the in-memory adapter is replaced for multi-instance fan-out.
onRedisReady((clients) => io.adapter(createAdapter(clients.publisher, clients.subscriber)));

// Which hops may name the client (TRUST_PROXY): every per-client limit and
// the address recorded on a session read `request.ip` through this.
app.set("trust proxy", environment.trustProxy);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(requestContext);
app.use(cors(corsOptions));
// Ahead of body parsing so nothing an old client or a webhook retry sends is read.
app.use(RETIRED_BILLING_PATHS, answerRetiredBilling);
app.use("/api", rejectUnsupportedApiContentType);
app.use(parseJsonBody);
const configuredGlobalLimit = Number.parseInt(process.env.GLOBAL_RATE_LIMIT_PER_15_MIN ?? "", 10);
// Per member when the request carries a valid access token, per address
// otherwise, so members behind one carrier NAT do not share one budget.
app.use("/api", createLimiter({ name: "global", windowMs: 900_000, limit: Number.isFinite(configuredGlobalLimit) ? Math.min(Math.max(configuredGlobalLimit, 100), 10_000) : 1_000, key: bearerOrClientKey, message: { success: false, message: "Too many requests; please try again later" } }));

app.get("/", (_request, response) => { response.send("Server is running"); });
app.get("/health/live", (_request, response) => { response.json({ status: "ok", uptimeSeconds: Math.floor(process.uptime()) }); });
/**
 * Ready when PostgreSQL answers. Redis is a degradation, not an outage, for a
 * single instance - the cache and rate limits fall back to local - but with
 * several replicas behind a load balancer the Socket.IO adapter and the shared
 * rate limits need it, so READINESS_REQUIRE_REDIS=true takes such an instance
 * out of rotation until Redis is back.
 */
const readiness = async () => {
  const databaseReady = await checkDatabaseHealth(); const redisStatus = getRedisStatus();
  const ready = databaseReady && (!environment.readinessRequiresRedis || redisStatus === "ready");
  return { ready, database: databaseReady ? "ready" : "not-ready", redis: redisStatus, degraded: redisStatus === "not-ready", capabilities: { mediaUploads: environment.mediaUploadsEnabled ? "configured" : "disabled", email: environment.emailEnabled ? "configured" : "disabled", backgroundJobs: environment.scheduledJobsEnabled ? "enabled" : "disabled", outboxTransport: environment.outboxTransport } };
};
app.get("/health/ready", async (_request, response) => {
  const { ready, ...report } = await readiness();
  response.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not-ready", ...report });
});

app.use("/api/auth", authRoutes); app.use("/api/user", userRouter); app.use("/api/post", postRouter); app.use("/api/story", storyRouter);
app.use("/api/message", messageRouter); app.use("/api/exercise", exerciseRouter); app.use("/api/routine", routineRouter); app.use("/api/workout", workoutRouter);
app.use("/api/admin", rbacRouter); app.use("/api/muscle-groups", muscleGroupRouter); app.use("/api/equipment", equipmentRouter); app.use("/api/media", mediaRouter); app.use("/api/measurements", measurementRouter);
app.use("/api/locations", locationRouter); app.use("/api/nearby", nearbyRouter); app.use("/api/notifications", notificationRouter);
// Public, unauthenticated HTML for shared links. Mounted at the root rather
// than under /api because it is a page address people paste into a chat, and
// the crawler that fetches it before them needs the Open Graph tags served on
// the first response.
app.use(shareRouter);
app.use(notFoundHandler); app.use(errorHandler);

io.use(async (socket, next) => {
  try {
    const token: unknown = socket.handshake.auth?.token;
    if (typeof token !== "string" || !token || token.length > 10_000) return next(new Error("Authentication required"));
    const payload = verifyAccessToken(token); if (!isUserId(payload.id) || !isUserId(payload.sid)) return next(new Error("Invalid user identity"));
    // A still-valid access token can outlive its session by up to fifteen
    // minutes; a socket opened in that window would then live on indefinitely.
    const [user, sessionActive] = await Promise.all([userService.getUserById(payload.id), isSessionActive(payload.sid, payload.id)]);
    if (!user) return next(new Error("User not found"));
    if (!sessionActive) return next(new Error("Session expired"));
    bindSocketIdentity(socket, { userId: payload.id, sessionId: payload.sid }, user); next();
  } catch (error: unknown) { logger.warn("socket_authentication_failed", safeErrorMetadata(error)); next(new Error("Authentication failed")); }
});
io.on("connection", (socket) => { void handleSocketConnection(socket).catch((error: unknown) => { logger.error("socket_initialization_failed", errorDiagnostics(error)); socket.disconnect(true); }); });
// Single-process mode (RUN_SCHEDULED_JOBS unset, the default for local
// development) keeps the housekeeping and the outbox in this process. A
// production deployment sets RUN_SCHEDULED_JOBS=false here and runs the
// scheduler and worker entry points instead (docs/operations/DEPLOYMENT.md).
const cron = initCronJobs();
const outboxRelay = environment.scheduledJobsEnabled && environment.outboxTransport === "direct" ? startDirectOutboxRelay() : null;
// This process then applies media.uploaded itself; the API image has no
// ffprobe, so say so once rather than let video events fail unexplained.
if (outboxRelay) void reportVideoProbeAvailability();
const opsServer = environment.metricsPort ? startOpsServer(environment.metricsPort, readiness) : null;
let shuttingDown = false;
const shutdown = async (signal: string, exitCode = 0): Promise<void> => {
  if (shuttingDown) return; shuttingDown = true; logger.info("shutdown_started", { signal });
  const forceExitTimer = setTimeout(() => process.exit(1), 10_000); forceExitTimer.unref();
  // Stop taking work first, then let the work already taken finish.
  await new Promise<void>((resolve) => io.close(() => resolve()));
  if (httpServer.listening) await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await Promise.allSettled([cron.stop(), outboxRelay?.stop()]);
  opsServer?.close();
  await Promise.allSettled([disconnectDatabase(), disconnectRedis()]);
  clearTimeout(forceExitTimer); process.exit(exitCode);
};
process.once("SIGTERM", () => { void shutdown("SIGTERM"); }); process.once("SIGINT", () => { void shutdown("SIGINT"); });
process.once("uncaughtException", (error) => { logger.error("uncaught_exception", errorDiagnostics(error)); void shutdown("uncaughtException", 1); });
process.once("unhandledRejection", (error) => { logger.error("unhandled_rejection", errorDiagnostics(error)); void shutdown("unhandledRejection", 1); });

/**
 * Redis is optional at every call site: the rate-limit store falls back to an
 * in-process one, the cache helpers no-op, and the socket adapter is swapped in
 * by onRedisReady whenever the connection lands.
 *
 * It is started only once the port is open. `redis` is by far the heaviest
 * import in the process - it pulls the bloom, json, search and time-series
 * command sets in on top of the client - and evaluating that module graph
 * blocks the event loop. Kicked off any earlier, even without awaiting it, that
 * block lands between listen() and its callback and delays the port by seconds.
 */
const connectRedisInBackground = (): void => {
  void initializeRedis().catch((error: unknown) => {
    logger.warn("redis_initialization_failed", safeErrorMetadata(error));
  });
};

try {
  httpServer.listen(environment.port, "0.0.0.0", () => {
    console.log(`Server + Socket.io running on port ${environment.port} (startup ${Date.now() - startupBegan}ms)`);
    connectRedisInBackground();
  });
  httpServer.on("error", (error: NodeJS.ErrnoException) => { logger.error(error.code === "EADDRINUSE" ? "http_port_in_use" : "http_server_error", { port: environment.port, ...safeErrorMetadata(error) }); void shutdown("httpServerError", 1); });
} catch (error: unknown) {
  logger.error("server_startup_failed", errorDiagnostics(error));
  if (isDatabaseReady()) await disconnectDatabase().catch(() => undefined);
  process.exit(1);
}
