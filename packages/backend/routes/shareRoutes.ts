import express from "express";
import rateLimit from "express-rate-limit";
import { isUuid } from "../utils/validation.js";
import { createRateLimitStore } from "../configs/redis.js";
import { findPublicPost, renderPostPage, renderUnavailablePage } from "../services/sharePageService.js";

const shareRouter = express.Router();

/**
 * The only unauthenticated HTML the server hands out.
 *
 * It sits outside `/api` on purpose: this is the URL people paste into a chat,
 * so it has to read like a page address rather than an endpoint. Every request
 * costs one indexed lookup and, for a post that is public, one more to hydrate
 * it — cheap, but exposed to the open internet, so it gets its own limiter
 * rather than sharing the API's budget.
 */
const sharePageLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("share-page"),
  message: "Too many requests",
});

shareRouter.get("/post/:postId", sharePageLimiter, async (request, response, next) => {
  try {
    const { postId } = request.params;
    const page = isUuid(postId)
      ? await findPublicPost(postId).then((entry) => (entry ? renderPostPage(entry) : renderUnavailablePage()))
      : renderUnavailablePage();

    response
      .status(page.status)
      // A crawler may hold this for a few minutes; a caption edit landing a
      // little late in a link preview is a fair trade for not re-querying on
      // every re-share of a popular post.
      .set("Cache-Control", page.status === 200 ? "public, max-age=300" : "no-store")
      .type("html")
      .send(page.html);
  } catch (error) {
    next(error);
  }
});

export default shareRouter;
