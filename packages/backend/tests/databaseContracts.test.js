import assert from "node:assert/strict";
import test from "node:test";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Post from "../models/Post.js";
import Story from "../models/Story.js";
import User from "../models/User.js";
import Workout from "../models/Workout.js";

const hasIndex = (schema, predicate) =>
  schema.indexes().some(([keys, options]) => predicate(keys, options));

test("story cleanup cannot bypass the durable media queue through TTL", () => {
  assert.equal(
    Story.schema
      .indexes()
      .some(([, options]) => options.expireAfterSeconds !== undefined),
    false
  );
  assert.equal(
    hasIndex(
      Story.schema,
      (keys) => keys.expiresAt === 1 && keys._id === 1
    ),
    true
  );
});

test("relationship and idempotency index contracts are declared", () => {
  assert.equal(
    hasIndex(
      Conversation.schema,
      (keys, options) => keys.pairKey === 1 && options.unique === true
    ),
    true
  );
  assert.equal(
    hasIndex(
      Message.schema,
      (keys) =>
        keys.conversationId === 1 &&
        keys.createdAt === -1 &&
        keys._id === -1
    ),
    true
  );
  assert.equal(
    hasIndex(
      Post.schema,
      (keys, options) =>
        keys.user === 1 &&
        keys.operationId === 1 &&
        options.unique === true
    ),
    true
  );
  assert.equal(
    hasIndex(
      Workout.schema,
      (keys, options) =>
        keys.userId === 1 &&
        keys.operationId === 1 &&
        options.unique === true
    ),
    true
  );
});

test("accepted connections are not duplicated inside user documents", () => {
  assert.equal(User.schema.path("connections"), undefined);
});

test("internal object-storage keys are not serialized to API clients", () => {
  const post = new Post({
    user: "user-1",
    content: "media",
    image_urls: ["https://example.invalid/post.png"],
    image_keys: ["posts/private-key.png"],
  }).toJSON();
  const story = new Story({
    user: "user-1",
    media_type: "image",
    media_url: "https://example.invalid/story.png",
    media_key: "stories/private-key.png",
  }).toJSON();
  const message = new Message({
    from_user_id: "user-1",
    to_user_id: "user-2",
    text: "hello",
    message_type: "text",
    media_key: "messages/private-key.png",
  }).toJSON();

  assert.equal("image_keys" in post, false);
  assert.equal("media_key" in story, false);
  assert.equal("media_key" in message, false);
});
