import "dotenv/config";
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import sharp from "sharp";
import { classifyProbeFailure, imageDimensionsFromBuffer, probeStoredVideo, probeVideoUrl, TransientMediaError, videoFactsFromProbe } from "../services/mediaProbeService.js";

const solid = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: "#7a4df5" } });

test("MED-02: dimensions come from the image itself", async () => {
  assert.deepEqual(await imageDimensionsFromBuffer(await solid(640, 360).jpeg().toBuffer()), { width: 640, height: 360 });
  assert.deepEqual(await imageDimensionsFromBuffer(await solid(48, 96).png().toBuffer()), { width: 48, height: 96 });
  assert.deepEqual(await imageDimensionsFromBuffer(await solid(120, 80).webp().toBuffer()), { width: 120, height: 80 });
});

test("a quarter-turn EXIF orientation reports the size a viewer sees", async () => {
  const portraitFromSideways = await solid(400, 300).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  assert.deepEqual(await imageDimensionsFromBuffer(portraitFromSideways), { width: 300, height: 400 });
});

test("the head of a file is enough; garbage and empty input give null instead of throwing", async () => {
  const full = await solid(1600, 900).png().toBuffer();
  assert.deepEqual(await imageDimensionsFromBuffer(full.subarray(0, 64)), { width: 1600, height: 900 });
  assert.equal(await imageDimensionsFromBuffer(Buffer.from("definitely not an image")), null);
  assert.equal(await imageDimensionsFromBuffer(Buffer.alloc(0)), null);
});

test("video facts come from ffprobe's description of the first video stream", () => {
  const probe = {
    streams: [{ codec_type: "audio", duration: "12.5" }, { codec_type: "video", width: 1920, height: 1080, duration: "12.48" }],
    format: { duration: "12.500000" },
  };
  assert.deepEqual(videoFactsFromProbe(probe), { width: 1920, height: 1080, durationSeconds: 12.48 });
});

test("a portrait phone video stored sideways reports the size a viewer sees", () => {
  const sideData = { streams: [{ codec_type: "video", width: 1920, height: 1080, side_data_list: [{ rotation: -90 }] }], format: { duration: "7.2" } };
  assert.deepEqual(videoFactsFromProbe(sideData), { width: 1080, height: 1920, durationSeconds: 7.2 });
  const legacyTag = { streams: [{ codec_type: "video", width: 1280, height: 720, tags: { rotate: "270" } }], format: { duration: "3" } };
  assert.deepEqual(videoFactsFromProbe(legacyTag), { width: 720, height: 1280, durationSeconds: 3 });
  const upsideDown = { streams: [{ codec_type: "video", width: 1280, height: 720, side_data_list: [{ rotation: 180 }] }], format: { duration: "3" } };
  assert.deepEqual(videoFactsFromProbe(upsideDown), { width: 1280, height: 720, durationSeconds: 3 });
});

test("a probe without a measurable video stream gives null", () => {
  for (const probe of [null, "text", {}, { streams: [] }, { streams: [{ codec_type: "audio", duration: "4" }] },
    { streams: [{ codec_type: "video", width: 0, height: 720 }], format: { duration: "4" } },
    { streams: [{ codec_type: "video", width: 640, height: 480 }], format: { duration: "N/A" } }]) {
    assert.equal(videoFactsFromProbe(probe), null);
  }
});

/*
 * MM-AUDIT-09 / NEW-10: a probe failure must not be recorded as "done" unless
 * the file itself is at fault. Network and storage errors are transient and
 * retried; a missing ffprobe is an error that ends up visible in `.dead`.
 */
const SIGNED = "https://bucket.s3.eu-north-1.amazonaws.com/posts/u/1-clip.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=deadbeef";
const failingRunner = (stderr: string, extra: Record<string, unknown> = {}) => async (): Promise<never> => {
  throw Object.assign(new Error(`Command failed: ffprobe ${SIGNED}\n${stderr}`), { code: 1, stderr, ...extra });
};

test("probe failures are sorted into transient (retry) and permanent (the file)", () => {
  for (const stderr of [
    `${SIGNED}: Server returned 5XX Server Error reply`,
    "HTTP error 503 Service Unavailable",
    "Server returned 403 Forbidden (access denied)",
    "Server returned 404 Not Found",
    "Connection to tcp://bucket.s3.amazonaws.com:443 failed: Connection timed out",
    "Network is unreachable",
    "Failed to resolve hostname bucket.s3.amazonaws.com: Temporary failure in name resolution",
    "Connection reset by peer",
  ]) assert.equal(classifyProbeFailure(stderr), "transient", stderr);
  for (const stderr of [
    `${SIGNED}: Invalid data found when processing input`,
    "[mov,mp4,m4a,3gp,3g2,mj2 @ 0x55] moov atom not found",
  ]) assert.equal(classifyProbeFailure(stderr), "permanent", stderr);
  assert.equal(classifyProbeFailure(""), "transient", "an unexplained failure is retried, never silently completed");
});

test("a network or storage failure throws so the event is retried; a broken file gives null", async () => {
  await assert.rejects(probeVideoUrl(SIGNED, failingRunner("Server returned 503 Service Unavailable")), TransientMediaError);
  await assert.rejects(probeVideoUrl(SIGNED, failingRunner("", { killed: true, signal: "SIGTERM" })), TransientMediaError);
  assert.equal(await probeVideoUrl(SIGNED, failingRunner("moov atom not found")), null);
  assert.equal(await probeVideoUrl(SIGNED, async () => ({ stdout: JSON.stringify({ streams: [{ codec_type: "audio" }] }), stderr: "" })), null, "no video stream is the file's fault");
  const facts = await probeVideoUrl(SIGNED, async () => ({ stdout: JSON.stringify({ streams: [{ codec_type: "video", width: 1920, height: 1080, duration: "3.5" }] }), stderr: "" }));
  assert.deepEqual(facts, { width: 1920, height: 1080, durationSeconds: 3.5 });
});

test("nothing logged on a probe failure carries the signed URL", async () => {
  const lines: string[] = [];
  const capture = (...args: unknown[]) => { lines.push(args.map(String).join(" ")); };
  const warn = mock.method(console, "warn", capture);
  const error = mock.method(console, "error", capture);
  const log = mock.method(console, "log", capture);
  try {
    await probeVideoUrl(SIGNED, failingRunner(`${SIGNED}: Invalid data found when processing input`)).catch(() => undefined);
    await probeVideoUrl(SIGNED, failingRunner(`${SIGNED}: Server returned 500`)).catch(() => undefined);
  } finally {
    warn.mock.restore(); error.mock.restore(); log.mock.restore();
  }
  assert.ok(lines.length > 0, "the failure is logged");
  for (const line of lines) {
    assert.ok(!line.includes("X-Amz-Signature"), line);
    assert.ok(!line.includes("amazonaws.com"), line);
  }
});

test("without ffprobe a video event fails instead of being recorded as done", async () => {
  await assert.rejects(probeStoredVideo("posts/u/1-clip.mp4", "definitely-not-an-ffprobe-binary"), /ffprobe/);
});
