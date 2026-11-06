import "./testDatabase.js";
import { IMAGEKIT_ENDPOINT } from "./signedMediaEnv.js";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { connectDatabase, database, disconnectDatabase } from "../../configs/database.js";
import { createPost, getFeedPostsForUser } from "../../services/postService.js";
import { getUserProfileAndPosts } from "../../services/userService.js";
import { createStory, getStoriesForUser } from "../../services/storyService.js";
import { createMessage, getChatMessagesList } from "../../services/messageService.js";
import { getUserById } from "../../services/userService.js";

/**
 * Every response that carries media hands out signed, expiring URLs (WP-06 of
 * the 2026-11 audit): posts (with their size variants), stories, message
 * photos, avatars and covers. A medium whose object key cannot be recovered is
 * reported unavailable instead of falling back to its unsigned URL.
 */
const runId = randomUUID().slice(0, 8);
const userIds: string[] = [];
const FIRST = { cursor: null, rawCursor: null, limit: 20 };
const ownUrl = (key: string): string => `${IMAGEKIT_ENDPOINT}/${key}?tr=q-auto,f-webp`;
const newUser = async (name: string): Promise<string> => {
  const row = await database.insertInto("users").values({
    legacy_mongo_id: null, email: `${name}-${runId}@example.test`, full_name: `${name} member`, username: `${name}_${runId}`, password_hash: "test-hash",
  }).returning("id").executeTakeFirstOrThrow();
  userIds.push(row.id);
  await database.updateTable("users").set({
    profile_picture_url: ownUrl(`profiles/${row.id}/1-me.jpg`), cover_photo_url: ownUrl(`covers/${row.id}/1-cover.jpg`),
  }).where("id", "=", row.id).execute();
  return row.id;
};
const assertSigned = (url: string | null | undefined, label: string): void => {
  assert.ok(url, `${label}: a URL`);
  const parsed = new URL(url);
  assert.ok(parsed.searchParams.get("ik-s"), `${label}: signed`);
  const expiry = Number(parsed.searchParams.get("ik-t"));
  assert.ok(expiry > Date.now() / 1000 && expiry < Date.now() / 1000 + 8 * 86_400, `${label}: expires within the delivery windows`);
};

test.before(async () => { await connectDatabase(); });
test.after(async () => {
  if (userIds.length) await database.deleteFrom("users").where("id", "in", userIds).execute();
  await disconnectDatabase();
});

test("posts in the feed and on a profile carry signed URLs and signed size variants", async () => {
  const author = await newUser("signauthor"); const viewer = await newUser("signviewer");
  const key = `posts/${author}/1-photo.jpg`;
  const post = await createPost({ user: author, operationId: randomUUID(), content: "photo", post_type: "image", visibility: "public", media: [{ url: ownUrl(key), key, contentType: "image/jpeg", sizeBytes: 1_000 }] });
  const fromFeed = (await getFeedPostsForUser(viewer, FIRST, "discover")).items.find((item) => item.id === post.id);
  assert.ok(fromFeed?.media?.[0]);
  assertSigned(fromFeed.media[0].url, "post media");
  assertSigned(fromFeed.image_urls[0], "image_urls");
  for (const variant of ["thumb", "feed", "detail"] as const) assertSigned(fromFeed.media[0].variants?.[variant], `variant ${variant}`);
  assert.match(fromFeed.media[0].variants!.feed, /w-720/);
  assert.ok(!fromFeed.media[0].url!.endsWith("f-webp"), "not the stored, unsigned URL");
  const author_ = typeof fromFeed.user === "object" ? fromFeed.user : null;
  assertSigned(author_?.profile_picture, "post author avatar");

  const profile = await getUserProfileAndPosts(author, viewer, FIRST as never);
  assertSigned(profile?.profile.profile_picture, "profile avatar");
  assertSigned(profile?.profile.cover_photo, "profile cover");
  assertSigned(profile?.posts[0]?.media?.[0]?.url, "profile post media");
});

test("a story's media URL is signed and expires with the story at the latest", async () => {
  const author = await newUser("signstory");
  const key = `stories/${author}/1-story.jpg`;
  const story = await createStory({ user: author, operationId: randomUUID(), content: "", media_url: ownUrl(key), media_key: key, media_type: "image", background_color: "#000000", overlays: [] });
  assertSigned(story.media_url, "story on create");
  const listed = (await getStoriesForUser(author, FIRST as never)).items.find((item) => item.id === story.id);
  assertSigned(listed?.media_url, "story in the list");
  assert.ok(Number(new URL(listed!.media_url!).searchParams.get("ik-t")) <= Date.parse(listed!.expiresAt) / 1000);
});

test("message photos and the account's own avatar are signed", async () => {
  const sender = await newUser("signsender"); const recipient = await newUser("signrecipient");
  const key = `messages/${sender}/1-pic.jpg`;
  const message = await createMessage({ from_user_id: sender, to_user_id: recipient, operationId: randomUUID(), text: "", message_type: "image", media_url: ownUrl(key), media_key: key });
  assertSigned(message.media_url, "message photo on send");
  const { items } = await getChatMessagesList(recipient, sender, FIRST as never);
  assertSigned(items[0]?.media_url, "message photo in the chat");
  assertSigned((await getUserById(sender))?.profile_picture, "own avatar");
});

test("a stored medium of ours whose key cannot be recovered is unavailable, not unsigned", async () => {
  const author = await newUser("signlost"); const viewer = await newUser("signlostviewer");
  const post = await createPost({ user: author, operationId: randomUUID(), content: "lost", post_type: "image", visibility: "public", media: [{ url: `${IMAGEKIT_ENDPOINT}/`, key: "", contentType: "image/jpeg", sizeBytes: 1_000 }] });
  const fromFeed = (await getFeedPostsForUser(viewer, FIRST, "discover")).items.find((item) => item.id === post.id);
  assert.equal(fromFeed?.media?.[0]?.url, null);
  assert.equal(fromFeed?.media?.[0]?.unavailable, true);
  assert.deepEqual(fromFeed?.image_urls, []);
});
