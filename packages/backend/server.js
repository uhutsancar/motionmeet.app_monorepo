import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import "dotenv/config";
import { createServer } from "http";
import { Server } from "socket.io";
import { verifyToken } from "@clerk/backend";
import connectDB from "./configs/db.js";
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js";
import { clerkMiddleware } from "@clerk/express";
import userRouter from "./routes/userRoutes.js";
import postRouter from "./routes/postRoutes.js";
import storyRouter from "./routes/storyRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import exerciseRouter from "./routes/exerciseRoutes.js";
import routineRouter from "./routes/routineRoutes.js";
import workoutRouter from "./routes/workoutRoutes.js";
import planRouter from "./routes/planRoutes.js";
import rbacRouter from "./routes/rbacRoutes.js";
import Message from "./models/Message.js";

const app = express();
const httpServer = createServer(app);

await connectDB();

// Global Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: "Too many requests from this IP, please try again after 15 minutes"
});

app.use(helmet());
app.use(express.json());
app.use(cors());

// Apply rate limiting and auth
app.use("/api", globalLimiter);
app.use("/api", clerkMiddleware());

app.get("/", (req, res) => res.send("Server is running"));
app.use("/api/inngest", serve({ client: inngest, functions }));
app.use("/api/user", userRouter);
app.use("/api/post", postRouter);
app.use("/api/story", storyRouter);
app.use("/api/message", messageRouter);
app.use("/api/exercise", exerciseRouter);
app.use("/api/routine", routineRouter);
app.use("/api/workout", workoutRouter);
app.use("/api/plans", planRouter);
app.use("/api/admin", rbacRouter);

// ─── Socket.io Setup ─────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"],
    credentials: true
  },
});

// Map: clerkUserId → Set of socketIds (a user can have multiple devices open)
const userSockets = new Map();

// Auth middleware for Socket.io
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No auth token"));

    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    socket.userId = payload.sub; // Clerk userId
    next();
  } catch (err) {
    console.error("Socket auth error:", err.message);
    next(new Error("Authentication failed"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.userId;
  console.log(`Socket connected: ${userId} (${socket.id})`);

  // Register this socket for the user
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId).add(socket.id);

  // Broadcast online status to all
  io.emit("user_online", { userId });

  // ── send_message event (text only; images still go through HTTP) ─────────
  socket.on("send_message", async ({ to_user_id, text }) => {
    if (!text?.trim()) return;
    try {
      const msg = await Message.create({
        from_user_id: userId,
        to_user_id,
        text: text.trim(),
        message_type: "text",
        media_url: "",
        seen: false,
      });

      const populated = await Message.findById(msg._id).populate("from_user_id");

      // Send to recipient's sockets
      const recipientSockets = userSockets.get(to_user_id);
      if (recipientSockets) {
        recipientSockets.forEach((sid) => {
          io.to(sid).emit("message_received", populated);
        });
      }

      // Confirm back to sender's sockets (all their devices)
      const senderSockets = userSockets.get(userId);
      if (senderSockets) {
        senderSockets.forEach((sid) => {
          io.to(sid).emit("message_sent", populated);
        });
      }
    } catch (err) {
      socket.emit("error", { msg: err.message });
    }
  });

  // ── typing indicators ─────────────────────────────────────────────────────
  socket.on("typing_start", ({ to_user_id }) => {
    const recipientSockets = userSockets.get(to_user_id);
    if (recipientSockets) {
      recipientSockets.forEach((sid) => {
        io.to(sid).emit("typing_start", { from_user_id: userId });
      });
    }
  });

  socket.on("typing_stop", ({ to_user_id }) => {
    const recipientSockets = userSockets.get(to_user_id);
    if (recipientSockets) {
      recipientSockets.forEach((sid) => {
        io.to(sid).emit("typing_stop", { from_user_id: userId });
      });
    }
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${userId} (${socket.id})`);
    userSockets.get(userId)?.delete(socket.id);
    if (!userSockets.get(userId)?.size) {
      userSockets.delete(userId);
      io.emit("user_offline", { userId });
    }
  });
});

// Export io so controllers can emit to sockets after HTTP actions (e.g. image messages)
export { io, userSockets };

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, "0.0.0.0", () =>
  console.log(`Server + Socket.io running on port ${PORT}`)
);
