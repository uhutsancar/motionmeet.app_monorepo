import type { EntityId, IdempotentRequest, Timestamped } from "./common.js";
import type { PublicUser } from "./user.js";

/** The type faces a story overlay can be set in. */
export const STORY_OVERLAY_FONTS = ["classic", "modern", "neon", "typewriter", "strong"] as const;
export type StoryOverlayFont = (typeof STORY_OVERLAY_FONTS)[number];

export const STORY_OVERLAY_ALIGNMENTS = ["left", "center", "right"] as const;
export type StoryOverlayAlignment = (typeof STORY_OVERLAY_ALIGNMENTS)[number];

/** `plate` is the filled pill Instagram calls a text highlight. */
export const STORY_OVERLAY_BACKDROPS = ["none", "plate", "translucent"] as const;
export type StoryOverlayBackdrop = (typeof STORY_OVERLAY_BACKDROPS)[number];

export const STORY_OVERLAY_KINDS = ["text", "location"] as const;
export type StoryOverlayKind = (typeof STORY_OVERLAY_KINDS)[number];

/** How many overlays one story may carry, and how long each caption may be. */
export const STORY_OVERLAY_LIMITS = Object.freeze({
  maxPerStory: 10,
  maxTextLength: 200,
  minScale: 0.4,
  maxScale: 4,
});

/**
 * A caption or sticker placed on top of a story.
 *
 * `x`/`y` are the centre of the overlay as a fraction of the story frame, so
 * the same story lands in the same spot on a 5" phone, a tablet and the web —
 * the composer never stores device pixels.
 */
export interface StoryOverlay {
  id: string;
  kind: StoryOverlayKind;
  text: string;
  /** 0–1, measured from the left edge of the frame. */
  x: number;
  /** 0–1, measured from the top edge of the frame. */
  y: number;
  /** Relative to the frame's base type size. */
  scale: number;
  /** Degrees, clockwise. */
  rotation: number;
  font: StoryOverlayFont;
  color: string;
  align: StoryOverlayAlignment;
  backdrop: StoryOverlayBackdrop;
}

export interface Story extends Timestamped, IdempotentRequest {
  id: EntityId;
  _id: EntityId;
  user: PublicUser | EntityId;
  content: string;
  media_url: string;
  media_type: "text" | "image" | "video";
  background_color: string;
  /** Captions and stickers drawn over the media, in paint order. */
  overlays: StoryOverlay[];
  expiresAt: string;
  /** Only populated for the author's own stories. */
  view_count?: number;
}

/** One viewer of a story, newest first. Author-only data. */
export interface StoryViewer {
  user: PublicUser;
  viewedAt: string;
}
