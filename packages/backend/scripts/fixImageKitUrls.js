/**
 * Normalize legacy ImageKit URLs.
 *
 * Dry-run by default:
 *   node scripts/fixImageKitUrls.js
 * Apply:
 *   node scripts/fixImageKitUrls.js --apply
 */

import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../configs/db.js";
import Story from "../models/Story.js";
import Post from "../models/Post.js";
import User from "../models/User.js";
import Exercise from "../models/Exercise.js";

const endpoint = process.env.IMAGEKIT_URL_ENDPOINT?.trim().replace(/\/$/, "");
const applyChanges = process.argv.includes("--apply");

if (!endpoint) {
  console.error("IMAGEKIT_URL_ENDPOINT is required");
  process.exit(1);
}

const endpointUrl = new URL(endpoint);
if (endpointUrl.protocol !== "https:" || endpointUrl.hostname !== "ik.imagekit.io") {
  console.error("IMAGEKIT_URL_ENDPOINT must be an https://ik.imagekit.io URL");
  process.exit(1);
}

const allowedFolders = "stories|posts|profiles|covers|messages|exercises";
const folderPattern = new RegExp(
  `https://ik\\.imagekit\\.io/[^/]+/?(${allowedFolders})/`,
);

const normalizeUrl = (value) => {
  if (typeof value !== "string" || !value.includes("ik.imagekit.io")) return value;
  const normalizedSlashes = value.replace(/([^:])\/{2,}/g, "$1/");
  return normalizedSlashes.replace(folderPattern, `${endpoint}/$1/`);
};

try {
  await connectDB();
  let changedStories = 0;
  let changedPosts = 0;
  let changedUsers = 0;
  let changedExercises = 0;

  for await (const story of Story.find({ media_url: /ik\.imagekit\.io/ }).cursor()) {
    const nextUrl = normalizeUrl(story.media_url);
    if (nextUrl === story.media_url) continue;
    changedStories += 1;
    if (applyChanges) {
      await Story.updateOne({ _id: story._id }, { $set: { media_url: nextUrl } });
    }
  }

  for await (const post of Post.find({ image_urls: /ik\.imagekit\.io/ }).cursor()) {
    const nextUrls = post.image_urls.map(normalizeUrl);
    if (nextUrls.every((url, index) => url === post.image_urls[index])) continue;
    changedPosts += 1;
    if (applyChanges) {
      await Post.updateOne({ _id: post._id }, { $set: { image_urls: nextUrls } });
    }
  }

  for await (const user of User.find({
    $or: [
      { profile_picture: /ik\.imagekit\.io/ },
      { cover_photo: /ik\.imagekit\.io/ },
    ],
  }).cursor()) {
    const nextProfilePicture = normalizeUrl(user.profile_picture);
    const nextCoverPhoto = normalizeUrl(user.cover_photo);
    if (
      nextProfilePicture === user.profile_picture &&
      nextCoverPhoto === user.cover_photo
    ) {
      continue;
    }
    changedUsers += 1;
    if (applyChanges) {
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            profile_picture: nextProfilePicture,
            cover_photo: nextCoverPhoto,
          },
        }
      );
    }
  }

  for await (const exercise of Exercise.find({ gifUrl: /ik\.imagekit\.io/ }).cursor()) {
    const nextUrl = normalizeUrl(exercise.gifUrl);
    if (nextUrl === exercise.gifUrl) continue;
    changedExercises += 1;
    if (applyChanges) {
      await Exercise.updateOne({ _id: exercise._id }, { $set: { gifUrl: nextUrl } });
    }
  }

  console.log(JSON.stringify({
    mode: applyChanges ? "apply" : "dry-run",
    changedStories,
    changedPosts,
    changedUsers,
    changedExercises,
  }));
} catch (error) {
  console.error(`ImageKit URL migration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
