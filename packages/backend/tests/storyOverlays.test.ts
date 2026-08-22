import assert from "node:assert/strict";
import test from "node:test";
import { STORY_OVERLAY_LIMITS } from "@motionmeet/shared";
import { parseStoryOverlays } from "../utils/storyOverlays.js";

const overlay = (patch: Record<string, unknown> = {}) => ({
  kind: "text",
  text: "Leg day",
  x: 0.5,
  y: 0.5,
  scale: 1,
  rotation: 0,
  font: "modern",
  color: "#FFFFFF",
  align: "center",
  backdrop: "none",
  ...patch,
});

test("an absent overlays field means no overlays, not a rejection", () => {
  assert.deepEqual(parseStoryOverlays(undefined), []);
  assert.deepEqual(parseStoryOverlays(null), []);
  assert.deepEqual(parseStoryOverlays(""), []);
});

test("overlays arrive as a JSON string from multipart bodies", () => {
  const parsed = parseStoryOverlays(JSON.stringify([overlay()]));
  assert.equal(parsed?.length, 1);
  assert.equal(parsed?.[0]?.text, "Leg day");
  assert.equal(parsed?.[0]?.font, "modern");
});

test("positions and scales are clamped into the frame", () => {
  const parsed = parseStoryOverlays([
    overlay({ x: -4, y: 12, scale: 900, rotation: 4000 }),
  ]);
  assert.equal(parsed?.[0]?.x, 0);
  assert.equal(parsed?.[0]?.y, 1);
  assert.equal(parsed?.[0]?.scale, STORY_OVERLAY_LIMITS.maxScale);
  assert.equal(parsed?.[0]?.rotation, 180);
});

test("unknown enum values fall back instead of reaching a renderer", () => {
  const parsed = parseStoryOverlays([
    overlay({ kind: "iframe", font: "comic-sans", align: "justify", backdrop: "video" }),
  ]);
  assert.equal(parsed?.[0]?.kind, "text");
  assert.equal(parsed?.[0]?.font, "classic");
  assert.equal(parsed?.[0]?.align, "center");
  assert.equal(parsed?.[0]?.backdrop, "none");
});

test("only a plain six-digit hex survives as a colour", () => {
  assert.equal(parseStoryOverlays([overlay({ color: "#aabbcc" })])?.[0]?.color, "#AABBCC");
  for (const hostile of ["red", "#fff", "url(javascript:alert(1))", "#fff; position:fixed"]) {
    assert.equal(parseStoryOverlays([overlay({ color: hostile })])?.[0]?.color, "#FFFFFF");
  }
});

test("client-supplied ids are replaced so they cannot collide or carry markup", () => {
  const parsed = parseStoryOverlays([
    overlay({ id: "<script>" }),
    overlay({ id: "<script>" }),
  ]);
  assert.deepEqual(parsed?.map((entry) => entry.id), ["o0", "o1"]);
});

test("malformed payloads are rejected rather than silently emptied", () => {
  assert.equal(parseStoryOverlays("{not json"), null);
  assert.equal(parseStoryOverlays({ x: 1 }), null);
  assert.equal(parseStoryOverlays([null]), null);
  assert.equal(parseStoryOverlays([overlay({ text: "   " })]), null);
  assert.equal(parseStoryOverlays([overlay({ x: "left" })]), null);
  assert.equal(
    parseStoryOverlays([overlay({ text: "x".repeat(STORY_OVERLAY_LIMITS.maxTextLength + 1) })]),
    null,
  );
  assert.equal(
    parseStoryOverlays(Array.from({ length: STORY_OVERLAY_LIMITS.maxPerStory + 1 }, () => overlay())),
    null,
  );
});
