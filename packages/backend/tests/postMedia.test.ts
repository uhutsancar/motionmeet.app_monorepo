import assert from "node:assert/strict";
import test from "node:test";
import { mediaKindOf, resolvePostType } from "../utils/postMedia.js";

const image = { contentType: "image/jpeg" };
const video = { contentType: "video/mp4" };

test("P0-PUBLISH-001: a caption-less photo post is an image post, not an empty one", () => {
  assert.equal(resolvePostType({ hasText: false, hasWorkout: false, media: [image] }), "image");
  assert.equal(resolvePostType({ hasText: true, hasWorkout: false, media: [image, image] }), "text_with_image");
  assert.equal(resolvePostType({ hasText: true, hasWorkout: false, media: [] }), "text");
});

test("P0-PUBLISH-003: the stored type follows the files, whatever the client declared", () => {
  // A video uploaded under a declared "image" type must be stored as video, so
  // players that cannot handle video are never handed one.
  assert.equal(resolvePostType({ hasText: false, hasWorkout: false, media: [image, video] }), "video");
  assert.equal(mediaKindOf("video/quicktime"), "video");
  assert.equal(mediaKindOf("VIDEO/MP4"), "video");
  assert.equal(mediaKindOf("image/heic"), "image");
});

test("a post carrying a workout is always a workout post, so the workout privacy setting applies", () => {
  assert.equal(resolvePostType({ hasText: true, hasWorkout: true, media: [image] }), "workout");
  assert.equal(resolvePostType({ hasText: false, hasWorkout: true, media: [] }), "workout");
});
