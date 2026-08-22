import { Platform, type TextStyle } from 'react-native';
import type { StoryOverlay, StoryOverlayFont } from '@motionmeet/shared';

/**
 * The five type treatments a story caption can be set in.
 *
 * No font binaries ship with the app: each style is built from a system family
 * plus weight, casing, tracking and glow, which keeps the bundle small and
 * renders identically on both platforms. `sample` is what the picker chip shows.
 */
export interface StoryFontDefinition {
  key: StoryOverlayFont;
  sample: string;
  style: TextStyle;
  /** Applied on top of `style` once the caption's colour is known. */
  glow?: boolean;
  uppercase?: boolean;
}

const monospace = Platform.select({ ios: 'Courier New', default: 'monospace' });

export const STORY_FONTS: readonly StoryFontDefinition[] = [
  {
    key: 'classic',
    sample: 'Classic',
    style: { fontWeight: '700', letterSpacing: 0 },
  },
  {
    key: 'modern',
    sample: 'MODERN',
    style: { fontWeight: '900', letterSpacing: 1.4 },
    uppercase: true,
  },
  {
    key: 'neon',
    sample: 'Neon',
    style: { fontWeight: '800', letterSpacing: 0.4 },
    glow: true,
  },
  {
    key: 'typewriter',
    sample: 'Typewriter',
    style: { fontFamily: monospace, fontWeight: '600', letterSpacing: 0.6 },
  },
  {
    key: 'strong',
    sample: 'Strong',
    style: { fontWeight: '900', letterSpacing: -0.6 },
  },
] as const;

const FONTS_BY_KEY = new Map(STORY_FONTS.map((font) => [font.key, font]));

export const storyFont = (key: StoryOverlayFont): StoryFontDefinition =>
  FONTS_BY_KEY.get(key) ?? STORY_FONTS[0]!;

/**
 * Base caption size for a frame.
 *
 * Derived from the frame width rather than a fixed point size, so a caption
 * covers the same share of the picture on a 5" phone, a tablet and the web —
 * this is what makes a story look the same everywhere it is opened.
 */
export const storyBaseFontSize = (frameWidth: number): number =>
  Math.round(Math.min(46, Math.max(19, frameWidth * 0.072)));

/** The pill behind a caption, when the author asked for one. */
export const storyBackdropStyle = (overlay: StoryOverlay, color: string) => {
  if (overlay.backdrop === 'plate') {
    return { backgroundColor: color, borderRadius: 8 };
  }
  if (overlay.backdrop === 'translucent') {
    return { backgroundColor: 'rgba(0,0,0,0.42)', borderRadius: 8 };
  }
  return null;
};

/**
 * Colour the caption is drawn in. A solid plate flips the text to a dark ink so
 * it stays readable when the plate itself takes the accent colour.
 */
export const storyTextColor = (overlay: StoryOverlay): string =>
  overlay.backdrop === 'plate' ? '#101014' : overlay.color;

export const storyTextTransform = (font: StoryFontDefinition): TextStyle['textTransform'] =>
  font.uppercase ? 'uppercase' : 'none';

/** Colours offered in the composer's swatch row, brand accent first. */
export const STORY_TEXT_COLORS = [
  '#FFFFFF',
  '#101014',
  '#9757FB',
  '#28E7F7',
  '#F86FE8',
  '#FF4D6D',
  '#FF8A3D',
  '#FFD84D',
  '#4ADE80',
  '#6B8CFF',
] as const;
