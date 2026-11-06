import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { imageDimensionsFromBuffer, videoFactsFromProbe } from "../services/mediaProbeService.js";

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
