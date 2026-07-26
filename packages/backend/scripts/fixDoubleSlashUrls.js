/**
 * Normalize duplicate path slashes in persisted media URLs.
 *
 * Dry-run by default:
 *   node scripts/fixDoubleSlashUrls.js
 * Apply:
 *   node scripts/fixDoubleSlashUrls.js --apply
 */

import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../configs/db.js";
import Post from "../models/Post.js";
import Story from "../models/Story.js";

const applyChanges = process.argv.includes("--apply");
const normalizeUrl = (value) =>
  typeof value === "string" ? value.replace(/([^:])\/{2,}/g, "$1/") : value;

try {
  await connectDB();
  let changedPosts = 0;
  let changedStories = 0;

  for await (const post of Post.find({ image_urls: /([^:])\/{2,}/ }).cursor()) {
    const nextUrls = post.image_urls.map(normalizeUrl);
    if (nextUrls.every((url, index) => url === post.image_urls[index])) continue;
    changedPosts += 1;
    if (applyChanges) {
      await Post.updateOne({ _id: post._id }, { $set: { image_urls: nextUrls } });
    }
  }

  for await (const story of Story.find({ media_url: /([^:])\/{2,}/ }).cursor()) {
    const nextUrl = normalizeUrl(story.media_url);
    if (nextUrl === story.media_url) continue;
    changedStories += 1;
    if (applyChanges) {
      await Story.updateOne({ _id: story._id }, { $set: { media_url: nextUrl } });
    }
  }

  console.log(JSON.stringify({
    mode: applyChanges ? "apply" : "dry-run",
    changedPosts,
    changedStories,
  }));
} catch (error) {
  console.error(`URL migration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
