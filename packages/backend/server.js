import express from "express";
import cors from "cors";
import "dotenv/config";
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

const app = express();

await connectDB();

app.use(express.json());
app.use(cors());
app.use(clerkMiddleware());

app.get("/", (req, res) => res.send("Server is running"));
// Set up the "/api/inngest" (recommended) routes with the serve handler
app.use("/api/inngest", serve({ client: inngest, functions }));
app.use("/api/user", userRouter);
app.use("/api/post", postRouter);
app.use("/api/story", storyRouter);
app.use("/api/message", messageRouter);
app.use("/api/exercise", exerciseRouter);
app.use("/api/routine", routineRouter);
app.use("/api/workout", workoutRouter);

const PORT = process.env.PORT || 4000;

app.listen(PORT, '0.0.0.0', () => console.log(`Server is running on port ${PORT}`));
