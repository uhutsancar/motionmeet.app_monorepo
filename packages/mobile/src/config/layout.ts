/**
 * Shared media and spacing sizes.
 *
 * Exercise artwork and avatars used to be sized ad hoc in every screen, so the
 * same thumbnail appeared at 32, 36, 40 and 48 points depending on where it was
 * rendered. Sizes live here so a thumbnail looks identical everywhere and the
 * card rhythm stays consistent across the app.
 */

/**
 * Type sizes, in the scale Instagram and Hevy use on a 360pt phone.
 *
 * Screens used to pick their own sizes and weights, and most picked 17-20pt at
 * weight 800-900. Android has no 800 cut of Roboto, so all of it rendered in
 * Roboto Black: every title, count and button looked shouted. Bold (700) is
 * for screen titles and figures; names and buttons are 600; rows are 500.
 */
export const TYPE = Object.freeze({
  /** Title of a tab's own screen ("Antrenman", the profile's username). */
  rootTitle: 21,
  /** Title of a pushed screen in its header. */
  title: 16.5,
  /** A heading inside a screen. */
  section: 15,
  /** The name on a list row. */
  row: 14.5,
  body: 14,
  /** Second line of a row, timestamps, chart notes. */
  meta: 12,
  button: 13.5,
  /** A headline figure: a total, a readout over a chart. */
  figure: 20,
});

/** Icon sizes: one set, outline, grey unless it is the content. */
export const ICON = Object.freeze({
  /** Header actions and the back chevron. */
  header: 24,
  tab: 24,
  /** Leading icon of a list row. */
  row: 19,
  /** Inside a button or beside a label. */
  inline: 15,
});

/**
 * Control sizes. Instagram's buttons are 32pt slabs; a 52pt purple bar is a
 * landing-page button, not an app control. `large` is for the one action a
 * screen exists for, such as starting a workout.
 */
export const CONTROL = Object.freeze({
  height: 32,
  large: 40,
  radius: 8,
  /** Search fields and single-line inputs. */
  field: 38,
});

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
  /** Post authors and comment threads. */
  medium: 34,
  /** People lists: followers, activity, search results. */
  row: 44,
  large: 80,
});

/** Post media keeps one aspect ratio so every photo occupies the same box. */
export const POST_MEDIA_ASPECT = 1.1;

/** Card rhythm: tighter than the previous 16/24 pairing. */
export const CARD = Object.freeze({
  radius: 12,
  padding: 12,
  gap: 10,
});

/**
 * Horizontal gutter of the feed's own content.
 *
 * Posts are full bleed and pad their contents by this much, so any section that
 * sits between them lines its title and first card up with the same edge.
 */
export const FEED_GUTTER = 16;

/**
 * Width of one card in a full-bleed horizontal feed carousel.
 *
 * Just under two thirds of the screen, so the next card always peeks in and the
 * row reads as scrollable, while the clamps keep it usable from a 320pt phone
 * up to a tablet.
 */
export const feedCarouselCardWidth = (usableWidth: number): number =>
  Math.round(Math.min(268, Math.max(198, usableWidth * 0.62)));

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
