import assert from "node:assert/strict";
import test, { mock } from "node:test";

/**
 * Signed, window-aligned media URLs (WP-06 of the 2026-11 audit, D-02).
 * ImageKit is configured with throwaway credentials before the modules load;
 * nothing here talks to ImageKit.
 */
process.env.IMAGEKIT_PUBLIC_KEY = "public_unit_test";
process.env.IMAGEKIT_PRIVATE_KEY = "private_unit_test";
process.env.IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/motionmeet-test";
delete process.env.MEDIA_SIGNED_DELIVERY;

const { DELIVERY_WINDOWS, deliverMedia, deliveredMediaUrl, expiryFor, profileImageUrl } = await import("../services/mediaDelivery.js");
const { resetEnvironmentForTests } = await import("../configs/environment.js");
const { registry } = await import("../observability/metrics.js");

const KEY = "posts/0b9c6c1e-1111-4222-8333-444455556666/1730000000000-abc-photo.jpg";
const STORED = `https://ik.imagekit.io/motionmeet-test/${KEY}?tr=q-auto,f-webp`;
const expiryOf = (url: string): number => Number(new URL(url).searchParams.get("ik-t"));
const atSecond = (seconds: number): void => { mock.timers.setTime(seconds * 1000); };

test.beforeEach(() => { mock.timers.enable({ apis: ["Date"], now: 1_800_000_000_000 }); });
test.afterEach(() => { mock.timers.reset(); delete process.env.MEDIA_SIGNED_DELIVERY; resetEnvironmentForTests(); });

test("every request in the same window gets the same signed URL", () => {
  atSecond(1_800_000_100);
  const first = deliveredMediaUrl({ purpose: "posts", key: KEY, contentType: "image/jpeg" });
  atSecond(1_800_000_100 + 3_000);
  const later = deliveredMediaUrl({ purpose: "posts", key: KEY, contentType: "image/jpeg" });
  assert.ok(first);
  assert.equal(later, first);
  const url = new URL(first);
  assert.ok(url.searchParams.get("ik-s"), "signed");
  assert.ok(url.searchParams.get("ik-t"), "with an expiry");
  assert.notEqual(url.searchParams.get("ik-t"), "9999999999", "never the SDK's no-expiry default");
});

test("a URL always has between M and W + M left, for every purpose", () => {
  for (const purpose of ["messages", "stories", "posts", "profiles", "covers", "sharePreview"] as const) {
    const { windowSeconds, minimumSeconds } = DELIVERY_WINDOWS[purpose];
    for (let offset = 0; offset < windowSeconds * 2; offset += Math.floor(windowSeconds / 37) + 1) {
      const now = 1_800_000_000 + offset;
      atSecond(now);
      const url = deliveredMediaUrl({ purpose, key: KEY, contentType: "image/jpeg" });
      assert.ok(url);
      const remaining = expiryOf(url) - now;
      assert.ok(remaining >= minimumSeconds && remaining < windowSeconds + minimumSeconds, `${purpose} at +${offset}s: ${remaining}s left`);
      assert.equal(expiryOf(url), expiryFor(purpose, now));
    }
  }
});

test("crossing a window boundary moves to the next expiry, never below M", () => {
  const { windowSeconds, minimumSeconds } = DELIVERY_WINDOWS.messages;
  const boundary = Math.ceil(1_800_000_000 / windowSeconds) * windowSeconds - minimumSeconds;
  atSecond(boundary - 1);
  const before = expiryOf(deliveredMediaUrl({ purpose: "messages", key: KEY })!);
  atSecond(boundary + 1);
  const after = expiryOf(deliveredMediaUrl({ purpose: "messages", key: KEY })!);
  assert.equal(after - before, windowSeconds);
  assert.ok(before - (boundary - 1) >= minimumSeconds);
  assert.ok(after - (boundary + 1) >= minimumSeconds);
});

test("a story's media never outlives the story", () => {
  atSecond(1_800_000_000);
  const notAfter = new Date((1_800_000_000 + 120) * 1000);
  const url = deliveredMediaUrl({ purpose: "stories", key: "stories/u/1-a.jpg", contentType: "image", notAfter });
  assert.equal(expiryOf(url!), 1_800_000_120);
});

test("when the SDK reads the clock a second later than we did, the URL is built again", () => {
  // Our first reading is one second behind the SDK's, so the expiry the SDK
  // computes is off by one; the retry reads the clock again and agrees.
  atSecond(1_800_000_500);
  const readings = [1_800_000_499_000, 1_800_000_500_000];
  const url = deliveredMediaUrl({ purpose: "posts", key: KEY }, () => readings.shift() ?? Date.now());
  assert.equal(expiryOf(url!), expiryFor("posts", 1_800_000_500));
  assert.equal(readings.length, 0, "the clock was read twice");
});

test("a medium of ours whose key cannot be recovered is unavailable, never handed out unsigned", async () => {
  const before = await registry.getSingleMetricAsString("motionmeet_media_url_unresolvable_total");
  const result = deliverMedia({ purpose: "posts", storedUrl: "https://ik.imagekit.io/motionmeet-test/" });
  assert.deepEqual(result, { url: null, unavailable: true });
  const after = await registry.getSingleMetricAsString("motionmeet_media_url_unresolvable_total");
  assert.notEqual(after, before, "counted");
  assert.match(after, /purpose="posts"/);
});

test("nothing stored is not 'unavailable'; a foreign URL is passed through", () => {
  assert.deepEqual(deliverMedia({ purpose: "stories", storedUrl: "", key: "" }), { url: "", unavailable: false });
  const foreign = "https://images.example.org/avatar.png";
  assert.equal(deliveredMediaUrl({ purpose: "profiles", storedUrl: foreign }), foreign);
});

test("the key is recovered from a stored URL when the row has none", () => {
  atSecond(1_800_000_000);
  const fromUrl = deliveredMediaUrl({ purpose: "posts", storedUrl: STORED, contentType: "image/jpeg" });
  const fromKey = deliveredMediaUrl({ purpose: "posts", key: KEY, contentType: "image/jpeg" });
  assert.equal(fromUrl, fromKey);
  assert.ok(fromUrl!.includes(KEY));
});

test("videos are delivered untransformed, images with their purpose's transformation", () => {
  atSecond(1_800_000_000);
  const video = new URL(deliveredMediaUrl({ purpose: "posts", key: "posts/u/1-clip.mp4", contentType: "video/mp4" })!);
  assert.equal(video.searchParams.get("tr"), null);
  const avatar = new URL(profileImageUrl(undefined, "profiles/u/1-me.jpg"));
  assert.match(avatar.searchParams.get("tr") ?? "", /w-512/);
});

test("an unresolvable avatar becomes the empty picture every client already handles", () => {
  assert.equal(profileImageUrl("https://ik.imagekit.io/motionmeet-test/"), "");
  assert.equal(profileImageUrl(""), "");
});

test("MEDIA_SIGNED_DELIVERY=false serves the stored URL again (rollout rollback only)", () => {
  process.env.MEDIA_SIGNED_DELIVERY = "false";
  resetEnvironmentForTests();
  assert.equal(deliveredMediaUrl({ purpose: "posts", key: KEY, storedUrl: STORED }), STORED);
});
