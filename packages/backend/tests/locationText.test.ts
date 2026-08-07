import assert from "node:assert/strict";
import test from "node:test";
import {
  MIN_QUERY_LENGTH,
  escapeLikePattern,
  formatAreaLabel,
  formatLocationLabel,
  normalizeLocationName,
  normalizeLocationQuery,
} from "../utils/locationText.js";

test("Turkish letters fold to the ASCII a member is likely to type", () => {
  assert.equal(normalizeLocationName("Nilüfer"), "nilufer");
  assert.equal(normalizeLocationName("İstanbul"), "istanbul");
  assert.equal(normalizeLocationName("Kadıköy"), "kadikoy");
  assert.equal(normalizeLocationName("Çanakkale"), "canakkale");
  assert.equal(normalizeLocationName("Muğla"), "mugla");
  assert.equal(normalizeLocationName("Şanlıurfa"), "sanliurfa");
});

test("case and accent variants of one place collapse to one key", () => {
  const spellings = ["Nilüfer", "NİLÜFER", "nilufer", "NILUFER", " Nilüfer "];
  const keys = new Set(spellings.map(normalizeLocationName));
  assert.equal(keys.size, 1, `expected one key, got ${[...keys].join(", ")}`);
});

test("Latin diacritics outside Turkish are folded too", () => {
  assert.equal(normalizeLocationName("São Paulo"), "sao paulo");
  assert.equal(normalizeLocationName("Ashkāsham"), "ashkasham");
  assert.equal(normalizeLocationName("Malmö"), "malmo");
  assert.equal(normalizeLocationName("Łódź"), "lodz");
  assert.equal(normalizeLocationName("Ålesund"), "alesund");
});

test("non-Latin names stay searchable in their own script", () => {
  // Stripping to ASCII would leave an empty key and make the row unreachable.
  assert.equal(normalizeLocationName("Москва"), "москва");
  assert.equal(normalizeLocationName("東京"), "東京");
});

test("punctuation and repeated spaces collapse to single separators", () => {
  assert.equal(normalizeLocationName("Saint-Étienne"), "saint etienne");
  assert.equal(normalizeLocationName("  Bursa,,  Türkiye "), "bursa turkiye");
});

test("queries shorter than the minimum are rejected rather than run", () => {
  assert.equal(normalizeLocationQuery("n"), null);
  assert.equal(normalizeLocationQuery(""), null);
  assert.equal(normalizeLocationQuery("  "), null);
  assert.equal(normalizeLocationQuery(42), null);
  assert.equal(normalizeLocationQuery("!!"), null);
  assert.equal("ni".length, MIN_QUERY_LENGTH);
  assert.equal(normalizeLocationQuery("Ni"), "ni");
});

test("LIKE wildcards in a query are escaped, not honoured", () => {
  // Without this a query of "%" would match every one of the 150k cities.
  assert.equal(escapeLikePattern("100%"), "100\\%");
  assert.equal(escapeLikePattern("a_b"), "a\\_b");
  assert.equal(escapeLikePattern("back\\slash"), "back\\\\slash");
});

test("profile labels join the parts that are present", () => {
  assert.equal(formatLocationLabel({ city: "Nilüfer", region: "Bursa", country: "Türkiye" }), "Nilüfer, Bursa, Türkiye");
  assert.equal(formatLocationLabel({ city: null, region: "Bursa", country: "Türkiye" }), "Bursa, Türkiye");
  assert.equal(formatLocationLabel({ country: "Türkiye" }), "Türkiye");
  assert.equal(formatLocationLabel({ city: "  ", region: null, country: "Türkiye" }), "Türkiye");
});

test("area labels drop the country and return null when empty", () => {
  assert.equal(formatAreaLabel({ city: "Nilüfer", region: "Bursa" }), "Nilüfer, Bursa");
  assert.equal(formatAreaLabel({ city: null, region: null }), null);
});
