import assert from "node:assert/strict";
import test from "node:test";
import { distanceBandFor } from "../utils/distanceBands.js";

test("nothing finer than a kilometre is ever reported", () => {
  // The privacy property the whole nearby feature rests on: an attacker who can
  // move their own fix and re-query still cannot resolve below this floor.
  for (const meters of [0, 1, 50, 183, 500, 999, 1_000]) {
    assert.equal(distanceBandFor(meters, "approximate", false), "nearby", `${meters}m leaked a finer band`);
  }
});

test("bands cover the documented ranges and their boundaries", () => {
  assert.equal(distanceBandFor(1_001, "approximate", false), "within_2km");
  assert.equal(distanceBandFor(2_000, "approximate", false), "within_2km");
  assert.equal(distanceBandFor(2_001, "approximate", false), "2_5km");
  assert.equal(distanceBandFor(5_000, "approximate", false), "2_5km");
  assert.equal(distanceBandFor(5_001, "approximate", false), "5_10km");
  assert.equal(distanceBandFor(10_000, "approximate", false), "5_10km");
  assert.equal(distanceBandFor(10_001, "approximate", false), "10_25km");
  assert.equal(distanceBandFor(25_000, "approximate", false), "10_25km");
  assert.equal(distanceBandFor(25_001, "approximate", false), "25_50km");
  assert.equal(distanceBandFor(50_000, "approximate", false), "25_50km");
});

test("beyond the last ring the answer degrades to a region, or a city if shared", () => {
  assert.equal(distanceBandFor(80_000, "approximate", false), "same_region");
  assert.equal(distanceBandFor(80_000, "approximate", true), "same_city");
});

test("the subject's visibility choice is what is applied", () => {
  // "nearby_only" keeps the member discoverable but flattens every distance.
  assert.equal(distanceBandFor(41_000, "nearby_only", false), "nearby");
  assert.equal(distanceBandFor(120, "nearby_only", false), "nearby");
  // "hidden" removes the signal entirely without removing the member.
  assert.equal(distanceBandFor(120, "hidden", false), "unknown");
  assert.equal(distanceBandFor(41_000, "hidden", true), "unknown");
});

test("a distance that could not be computed says so instead of guessing", () => {
  assert.equal(distanceBandFor(Number.NaN, "approximate", false), "unknown");
  assert.equal(distanceBandFor(-1, "approximate", false), "unknown");
  assert.equal(distanceBandFor(Number.POSITIVE_INFINITY, "approximate", false), "unknown");
});
