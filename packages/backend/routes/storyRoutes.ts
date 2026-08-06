import express from "express";
import { storyMediaUpload } from "../configs/multer.js";
import { attachDbUser, protect } from "../middlewares/auth.js";
import { addUserStory, deleteStory, getStories, getStoryViewers, viewStory } from "../controllers/storyController.js";

const storyRouter = express.Router();

storyRouter.post("/create", protect, attachDbUser, storyMediaUpload.single("media"), addUserStory);
storyRouter.get("/get", protect, getStories);
storyRouter.delete("/delete/:storyId", protect, deleteStory);
storyRouter.post("/:storyId/view", protect, viewStory);
storyRouter.get("/:storyId/viewers", protect, getStoryViewers);

export default storyRouter;
