/**
 * Shared media and spacing sizes.
 *
 * Exercise artwork and avatars used to be sized ad hoc in every screen, so the
 * same thumbnail appeared at 32, 36, 40 and 48 points depending on where it was
 * rendered. Sizes live here so a thumbnail looks identical everywhere and the
 * card rhythm stays consistent across the app.
 */

/** Circular exercise artwork, matching the training apps' round thumbnails. */
export const EXERCISE_THUMB = Object.freeze({
  /** Dense rows: routine builder, workout summaries, feed workout slides. */
  small: 34,
  /** Default list rows and the active workout header. */
  medium: 40,
  /** Leading artwork on browse lists. */
  large: 44,
});

/** Avatars. Story bubbles size themselves against the ring, not these. */
export const AVATAR = Object.freeze({
  small: 28,
  medium: 38,
  large: 64,
});

/** Post media keeps one aspect ratio so every photo occupies the same box. */
export const POST_MEDIA_ASPECT = 1.1;

/** Card rhythm: tighter than the previous 16/24 pairing. */
export const CARD = Object.freeze({
  radius: 12,
  padding: 12,
  gap: 10,
});

export const exerciseThumbStyle = (size: number) => ({
  width: size,
  height: size,
  borderRadius: size / 2,
});

/**
 * Width of one tile in an evenly spaced grid.
 *
 * Compact stat tiles read better two per row even on narrow phones - the
 * generic column count is meant for wide content, and using it here made every
 * tile span the full screen.
 */
export const gridItemWidth = (contentWidth: number, gap: number, perRow = 2): number =>
  Math.max(120, (contentWidth - gap * (perRow - 1)) / perRow);
