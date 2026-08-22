import type { CSSProperties } from "react";
import type { StoryOverlay, StoryOverlayFont } from "@motionmeet/shared";

/**
 * The five type treatments a story caption can be set in.
 *
 * These mirror the mobile definitions one for one — same weights, casing,
 * tracking and glow — so a story composed on a phone reads the same way in a
 * browser. No font files are shipped; each style is built from a system stack.
 */
export interface StoryFontDefinition {
  key: StoryOverlayFont;
  sample: string;
  style: CSSProperties;
  glow?: boolean;
}

export const STORY_FONTS: readonly StoryFontDefinition[] = [
  { key: "classic", sample: "Classic", style: { fontWeight: 700, letterSpacing: 0 } },
  {
    key: "modern",
    sample: "MODERN",
    style: { fontWeight: 900, letterSpacing: "0.05em", textTransform: "uppercase" },
  },
  { key: "neon", sample: "Neon", style: { fontWeight: 800, letterSpacing: "0.015em" }, glow: true },
  {
    key: "typewriter",
    sample: "Typewriter",
    style: { fontFamily: '"Courier New", ui-monospace, monospace', fontWeight: 600, letterSpacing: "0.02em" },
  },
  { key: "strong", sample: "Strong", style: { fontWeight: 900, letterSpacing: "-0.02em" } },
] as const;

const FONTS_BY_KEY = new Map(STORY_FONTS.map((font) => [font.key, font]));

export const storyFont = (key: StoryOverlayFont): StoryFontDefinition =>
  FONTS_BY_KEY.get(key) ?? STORY_FONTS[0]!;

/**
 * Base caption size for a frame, derived from its width so a caption covers the
 * same share of the picture at any size. Matches `storyBaseFontSize` on mobile.
 */
export const storyBaseFontSize = (frameWidth: number): number =>
  Math.round(Math.min(46, Math.max(19, frameWidth * 0.072)));

/** Colours offered in the composer's swatch row, brand accent first. */
export const STORY_TEXT_COLORS = [
  "#FFFFFF",
  "#101014",
  "#9757FB",
  "#28E7F7",
  "#F86FE8",
  "#FF4D6D",
  "#FF8A3D",
  "#FFD84D",
  "#4ADE80",
  "#6B8CFF",
] as const;

/** The complete inline style for one caption, backdrop included. */
export const storyOverlayStyle = (overlay: StoryOverlay, frameWidth: number): CSSProperties => {
  const font = storyFont(overlay.font);
  const fontSize = storyBaseFontSize(frameWidth) * overlay.scale;
  const onPlate = overlay.backdrop === "plate";

  return {
    ...font.style,
    fontSize,
    lineHeight: 1.22,
    textAlign: overlay.align,
    color: onPlate ? "#101014" : overlay.color,
    backgroundColor: onPlate
      ? overlay.color
      : overlay.backdrop === "translucent"
        ? "rgba(0,0,0,0.42)"
        : "transparent",
    borderRadius: overlay.backdrop === "none" ? 0 : 8,
    padding: overlay.backdrop === "none" ? 0 : `${fontSize * 0.1}px ${fontSize * 0.28}px`,
    textShadow: font.glow
      ? `0 0 ${fontSize * 0.5}px ${overlay.color}`
      : overlay.backdrop === "none"
        ? "0 1px 5px rgba(0,0,0,0.45)"
        : "none",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    margin: 0,
  };
};
