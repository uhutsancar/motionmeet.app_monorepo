/**
 * Search-key normalisation for the location dataset.
 *
 * The importer writes `search_name` with this function and the search endpoint
 * runs the incoming query through the same one, so "Nilufer", "nilüfer" and
 * "NİLÜFER" all reduce to `nilufer` and hit the same b-tree prefix.
 *
 * Turkish is folded explicitly because `String.prototype.toLowerCase` gets it
 * wrong in both directions: "İ" lower-cases to "i" plus a combining dot, and
 * dotless "ı" never reaches "i" at all. Letters outside the Latin script are
 * kept as-is - a Cyrillic or Greek city name stays searchable in its own
 * alphabet rather than collapsing to an empty key.
 */

const EXPLICIT_FOLDS: Readonly<Record<string, string>> = Object.freeze({
  İ: "i", I: "i", ı: "i",
  Ş: "s", ş: "s",
  Ğ: "g", ğ: "g",
  Ü: "u", ü: "u",
  Ö: "o", ö: "o",
  Ç: "c", ç: "c",
  // Latin letters that carry no decomposable accent, so NFD leaves them alone.
  Ø: "o", ø: "o",
  Æ: "ae", æ: "ae",
  Œ: "oe", œ: "oe",
  ß: "ss",
  Đ: "d", đ: "d", Ð: "d", ð: "d",
  Ł: "l", ł: "l",
  Þ: "th", þ: "th",
  Ħ: "h", ħ: "h",
});

const FOLDABLE = new RegExp(`[${Object.keys(EXPLICIT_FOLDS).join("")}]`, "g");
const COMBINING_MARKS = /[\u0300-\u036f]/gu;
const NON_ALPHANUMERIC = /[^\p{L}\p{N}]+/gu;

/** Longest key the schema can hold; longer names are truncated, not rejected. */
export const MAX_SEARCH_NAME_LENGTH = 240;

export const normalizeLocationName = (value: string): string =>
  value
    .replace(FOLDABLE, (character) => EXPLICIT_FOLDS[character] ?? character)
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, " ")
    .trim()
    .slice(0, MAX_SEARCH_NAME_LENGTH);

/**
 * Normalises a user-typed query and rejects the ones not worth a round trip.
 * Two characters is the floor: a single letter matches tens of thousands of
 * cities and the result would be noise either way.
 */
export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 80;

export const normalizeLocationQuery = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = normalizeLocationName(value.slice(0, MAX_QUERY_LENGTH));
  return normalized.length >= MIN_QUERY_LENGTH ? normalized : null;
};

/**
 * Builds the label shown on a profile. The backend is the only writer, so a
 * client can never inject its own text into someone else's profile card.
 * Country stays in the label because "Cambridge, Massachusetts" and
 * "Cambridge, England" are otherwise indistinguishable.
 */
export const formatLocationLabel = (parts: {
  city?: string | null;
  region?: string | null;
  country: string;
}): string => [parts.city, parts.region, parts.country].filter((part): part is string => Boolean(part?.trim())).join(", ");

/** Short label for "where you are right now"; the country adds nothing there. */
export const formatAreaLabel = (parts: { city?: string | null; region?: string | null }): string | null => {
  const label = [parts.city, parts.region].filter((part): part is string => Boolean(part?.trim())).join(", ");
  return label || null;
};
