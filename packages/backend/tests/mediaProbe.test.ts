import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { imageDimensionsFromBuffer } from "../services/mediaProbeService.js";

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
