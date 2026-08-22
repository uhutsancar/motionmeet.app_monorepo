import {
  STORY_OVERLAY_ALIGNMENTS,
  STORY_OVERLAY_BACKDROPS,
  STORY_OVERLAY_FONTS,
  STORY_OVERLAY_KINDS,
  STORY_OVERLAY_LIMITS,
  type StoryOverlay,
} from "@motionmeet/shared";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const isOneOf = <T extends string>(options: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (options as readonly string[]).includes(value);

/**
 * Turns whatever a client sent into overlays the renderers can trust.
 *
 * Every field is re-derived here rather than accepted as given: positions and
 * scales are clamped so an overlay can never be parked off-frame or blown up to
 * cover a report button, enums fall back to their defaults, and the colour must
 * be a plain six-digit hex so nothing that reaches a style attribute can carry
 * markup. Returns `null` when the payload is the wrong shape or too long, which
 * the caller turns into a 400 rather than silently dropping the captions the
 * author wrote.
 */
export const parseStoryOverlays = (value: unknown): StoryOverlay[] | null => {
  if (value === undefined || value === null || value === "") return [];

  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(raw)) return null;
  if (raw.length > STORY_OVERLAY_LIMITS.maxPerStory) return null;

  const overlays: StoryOverlay[] = [];
  for (const [index, entry] of raw.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const candidate = entry as Record<string, unknown>;

    const text = typeof candidate.text === "string" ? candidate.text.trim() : "";
    if (!text || text.length > STORY_OVERLAY_LIMITS.maxTextLength) return null;

    const x = Number(candidate.x);
    const y = Number(candidate.y);
    const scale = Number(candidate.scale);
    const rotation = Number(candidate.rotation);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

    overlays.push({
      // Ids only have to be unique within one story, so they are re-issued here
      // instead of trusting a client-supplied key.
      id: `o${index}`,
      kind: isOneOf(STORY_OVERLAY_KINDS, candidate.kind) ? candidate.kind : "text",
      text,
      x: clamp(x, 0, 1),
      y: clamp(y, 0, 1),
      scale: Number.isFinite(scale)
        ? clamp(scale, STORY_OVERLAY_LIMITS.minScale, STORY_OVERLAY_LIMITS.maxScale)
        : 1,
      rotation: Number.isFinite(rotation) ? clamp(rotation, -180, 180) : 0,
      font: isOneOf(STORY_OVERLAY_FONTS, candidate.font) ? candidate.font : "classic",
      color: typeof candidate.color === "string" && HEX_COLOR.test(candidate.color)
        ? candidate.color.toUpperCase()
        : "#FFFFFF",
      align: isOneOf(STORY_OVERLAY_ALIGNMENTS, candidate.align) ? candidate.align : "center",
      backdrop: isOneOf(STORY_OVERLAY_BACKDROPS, candidate.backdrop) ? candidate.backdrop : "none",
    });
  }

  return overlays;
};
