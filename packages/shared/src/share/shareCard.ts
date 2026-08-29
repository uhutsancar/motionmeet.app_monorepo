/**
 * MotionMeet share cards.
 *
 * A share card is the picture someone posts to Instagram or sends to a friend
 * after a workout: their numbers, laid out properly, with the mark on it. This
 * module is the only place one is drawn.
 *
 * It produces SVG rather than pixels, and it lives in the shared package, so
 * exactly one renderer serves both sides:
 *
 *   - the app draws the same string with `react-native-svg`, which makes the
 *     picker instant and works with no network at all;
 *   - the server rasterises it with sharp when a real file is needed — to save
 *     to the camera roll, to hand to another app, or as the image a link
 *     preview shows.
 *
 * If the two had separate implementations the preview would drift from the file
 * people actually share, which is the one thing a share card may not do.
 */

/** Every layout the picker offers, in the order it shows them. */
export const SHARE_CARD_TEMPLATES = [
  "summary",
  "stats",
  "exercises",
  "highlight",
  "minimal",
] as const;
export type ShareCardTemplate = (typeof SHARE_CARD_TEMPLATES)[number];

export const SHARE_CARD_SIZES = {
  /** Instagram/WhatsApp stories, and the shape the picker previews. */
  story: { width: 1080, height: 1920 },
  /** Feed posts and anywhere a square reads better. */
  square: { width: 1080, height: 1080 },
} as const;
export type ShareCardSize = keyof typeof SHARE_CARD_SIZES;

export interface ShareCardStat {
  label: string;
  value: string;
}

export interface ShareCardExercise {
  /** How many sets were logged, rendered as the "3x" prefix. */
  sets: number;
  name: string;
  /** Equipment code, so the row can carry the right little drawing. */
  equipment?: string;
  /** Muscle-group or body-part code, used to shade the figure on the card. */
  muscleGroup?: string;
}

export interface ShareCardData {
  /** The workout's name — the headline of every template that has one. */
  title: string;
  /** Shown under the mark; the "@" is added here, not by the caller. */
  username: string;
  stats: ShareCardStat[];
  exercises: ShareCardExercise[];
  /** Optional line under the title: a date, a place, anything short. */
  subtitle?: string;
  /**
   * Regions to shade on the body diagram.
   *
   * Derived from the workout's exercises rather than asked for: a chest day
   * shades the chest. Empty means the diagram is left out entirely, which is
   * what happens for a session whose movements carry no muscle data.
   */
  muscles?: string[];
  /**
   * Draw the card for laying over a photo instead of on the brand plate.
   *
   * This is the Strava case: the picture stays the subject and the numbers sit
   * on top of it under a gradient scrim. The photo itself is *not* referenced
   * from the SVG — neither `react-native-svg` nor sharp's rasteriser fetches a
   * remote image, and embedding a multi-megabyte data URI would be worse than
   * either. The renderer emits the scrim and the type on a transparent ground,
   * and whoever has the photo composites the two.
   */
  overPhoto?: boolean;
}

/** The mark's own palette, so a card can never drift from the logo. */
export const SHARE_CARD_COLORS = Object.freeze({
  plateTop: "#141C2E",
  plateMiddle: "#0D1424",
  plateBottom: "#070B15",
  accentStart: "#3B82F6",
  accentMiddle: "#2FA9F4",
  accentEnd: "#22D3EE",
  text: "#F5F7FB",
  textMuted: "rgba(245,247,251,0.62)",
});

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Clips a label to a width the layout can hold.
 *
 * Counted in characters rather than measured, deliberately: the app and the
 * server rasterise with different text engines, and a layout that depends on
 * one of them agreeing with the other about the width of a string is a layout
 * that breaks on somebody's phone. A fixed character budget breaks in the same
 * place everywhere.
 */
const clip = (value: string, max: number): string => {
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1).trimEnd()}…`;
};

/**
 * The type stack.
 *
 * DejaVu is named first because it is what the server has — the container
 * installs it — and the rest are what phones and browsers have. Every name here
 * is a grotesque of similar proportions, so a card composed against one and
 * rasterised with another lands in the same place.
 */
const FONT = "'DejaVu Sans','Helvetica Neue',Helvetica,Roboto,Arial,sans-serif";

interface TextOptions {
  x: number;
  y: number;
  size: number;
  weight?: number;
  fill?: string;
  anchor?: "start" | "middle" | "end";
  spacing?: number;
  opacity?: number;
}

const text = (value: string, options: TextOptions): string => {
  const {
    x,
    y,
    size,
    weight = 400,
    fill = SHARE_CARD_COLORS.text,
    anchor = "start",
    spacing = 0,
    opacity = 1,
  } = options;
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${spacing}" opacity="${opacity}">${escapeXml(value)}</text>`;
};

/** The mark, drawn at any size, from the same path as `brand/`. */
const mark = (x: number, y: number, size: number): string => {
  const scale = size / 512;
  return `<g transform="translate(${x} ${y}) scale(${scale})">
<path d="M112 380V166l144 138 144-138v214" fill="none" stroke="url(#mmAccent)" stroke-width="62" stroke-linecap="round" stroke-linejoin="round"/>
</g>`;
};

/** Mark plus wordmark plus handle — the footer every template shares. */
const brandRow = (x: number, y: number, username: string, width: number): string => {
  const markSize = 56;
  return [
    mark(x, y - markSize + 8, markSize),
    text("MotionMeet", { x: x + markSize + 18, y, size: 40, weight: 700, spacing: -0.5 }),
    text(`@${username}`, {
      x: x + width,
      y,
      size: 34,
      weight: 500,
      anchor: "end",
      fill: SHARE_CARD_COLORS.textMuted,
    }),
  ].join("\n");
};

/**
 * The largest type a row of values will fit in.
 *
 * A stat row divides the card evenly, so three short numbers ("4", "240 kg")
 * can be set large while "1 sa 10 dk" beside "20.6 km/sa" cannot — at a fixed
 * size the two collided. 0.58em is a grotesque's average advance width, which
 * is close enough to keep the columns apart without measuring anything.
 */
const fittedValueSize = (values: string[], columnWidth: number, preferred: number): number => {
  const longest = Math.max(1, ...values.map((value) => value.length));
  return Math.max(30, Math.min(preferred, Math.floor((columnWidth * 0.92) / (longest * 0.58))));
};

/** One stat, drawn as a big number over a small label. */
const statBlock = (stat: ShareCardStat, x: number, y: number, valueSize: number, anchor: TextOptions["anchor"] = "start"): string =>
  [
    text(stat.value, { x, y, size: valueSize, weight: 700, anchor, spacing: -1 }),
    text(stat.label.toUpperCase(), {
      x,
      y: y + valueSize * 0.62,
      size: valueSize * 0.3,
      weight: 600,
      anchor,
      spacing: 2.2,
      fill: SHARE_CARD_COLORS.textMuted,
    }),
  ].join("\n");

/* ── Drawings ─────────────────────────────────────────────────────────────── */

/**
 * The regions a muscle code can shade, and every name that maps onto one.
 *
 * The exercise dataset says "upper arms", the app's catalogue says "arms" and a
 * movement's `target` says "triceps"; all three have to light the same part of
 * the figure, so they are folded together here.
 */
type MuscleRegion = "chest" | "back" | "legs" | "shoulders" | "arms" | "abs";

const REGION_BY_MUSCLE: Record<string, MuscleRegion> = {
  chest: "chest", pectorals: "chest",
  back: "back", lats: "back", "upper back": "back", traps: "back", spine: "back",
  legs: "legs", "upper legs": "legs", "lower legs": "legs", quads: "legs",
  hamstrings: "legs", glutes: "legs", calves: "legs", adductors: "legs", abductors: "legs",
  shoulders: "shoulders", delts: "shoulders", neck: "shoulders",
  arms: "arms", "upper arms": "arms", "lower arms": "arms", biceps: "arms",
  triceps: "arms", forearms: "arms",
  abs: "abs", waist: "abs", core: "abs",
};

const regionFor = (muscle: string): MuscleRegion | null =>
  REGION_BY_MUSCLE[muscle.trim().toLowerCase().replace(/[_\s]+/g, " ")] ?? null;

/**
 * How wide the body diagram is, as a fraction of its height.
 *
 * Callers place the figure by its right edge, so they need its width without
 * having to know the drawing's grid.
 */
export const SHARE_CARD_BODY_ASPECT = 59 / 176;

/** Left edge of the drawn figure on its grid; the margin either side is trimmed. */
const BODY_LEFT = 18.5;
/** Full height of the grid the parts below are authored on. */
const BODY_GRID_HEIGHT = 176;

/** Joins the emitted paths; named so the literal survives every editor. */
const NEWLINE = String.fromCharCode(10);

/**
 * The body, as a silhouette and a set of muscle plates laid over it.
 *
 * Everything below is authored on a 96 x 176 grid with the spine on x = 48, and
 * only the left half is written out: the right half is the same paths mirrored
 * about the spine, so the two sides can never drift apart.
 *
 * The silhouette is drawn first, in one group with a single opacity so the
 * overlapping limbs do not stack into darker seams where they meet. The plates
 * then sit on top of it, and only they ever take the brand colour.
 */
const BODY_SILHOUETTE: string[] = [
  // Head and neck.
  "M47.4 2.4h.6a10.6 10.6 0 0 1 0 21.2h-.6Z",
  "M43 21h5.6v13H46a3 3 0 0 1-3-3Z",
  // Torso, tapering from the shoulders to the waist.
  "M32 36C38 31.4 42.8 29.6 48.6 29.6V98H35L29 56C28.4 47 29 40 32 36Z",
  // Hips, so the trunk does not end in mid-air above the legs.
  "M34 94h14.6v20h-7.6c-4 0-6.5-2-7-6Z",
  // Upper arm, forearm and hand, hanging beside the body.
  "M19.5 46c4-3 8-2.5 10.5 1.5l1.5 28c.3 4-2 6.3-5.6 6.3s-5.8-2.3-6-6.3l-1-23c-.2-3.4 0-5.4.6-6.5Z",
  "M19.8 80c3.2-1.4 6.6-1.2 9.4.6l1.4 24c.2 3.2-1.6 5-4.8 5s-5-1.8-5.2-5Z",
  "M21 106h9.4l.5 8.6c.1 2.6-1.6 4-4.7 4s-4.9-1.4-5-4Z",
  // Thigh, shin and foot.
  "M33 104c5-2.4 10-2.4 14.6 0l-.6 32c-.1 4.4-2.7 6.6-7.4 6.6s-7.2-2.2-7.4-6.6l-.8-24c-.06-4 .2-6.6 1.6-8Z",
  "M35 140c4-1.6 7.8-1.6 11.2 0l-.7 24c-.1 3.6-2 5.4-5 5.4s-4.8-1.8-4.9-5.4Z",
  "M35.6 166.6h9.6v4c0 1.9-1.4 2.9-4.2 2.9h-9.6c-1.9 0-2.8-.8-2.8-2.4Z",
];

const BODY_MUSCLES: Array<{ d: string; region: MuscleRegion }> = [
  // Trapezius and latissimus: the two parts of a back a front view can show.
  { region: "back", d: "M32.5 37.4C38 32.4 42.8 30 47.2 29.4V37.6C43.4 38.4 39.6 40.4 36.4 43.4Z" },
  { region: "back", d: "M31.2 51.4 35.8 53C35.8 60.6 36.8 67.6 38.8 74L34.6 80.6C31.4 72.4 30.2 62.6 31.2 51.4Z" },
  // Deltoid, capping the shoulder.
  { region: "shoulders", d: "M31.8 38.6C26.4 41 22.8 45.2 21.8 51.4 21.2 55 22.8 57 26.2 57.2 29.4 57.4 31.2 55.6 31.8 52 32.4 47.6 34 44.2 36.6 41.8Z" },
  // Pectoral, hung off the sternum and running out under the deltoid.
  { region: "chest", d: "M47.2 40.6V60.8H38.2C33.6 60.8 31.4 58.4 31.4 53.8V48.6C31.4 44.6 33.8 42.2 38.4 41.2 41.4 40.5 44.3 40.3 47.2 40.6Z" },
  // Abdominals: three rows of blocks, the oblique beside them, the wedge below.
  { region: "abs", d: "M39.8 62.4H46.6V70.8H39.8Z" },
  { region: "abs", d: "M39.8 72.4H46.6V80.8H39.8Z" },
  { region: "abs", d: "M39.8 82.4H46.6V90.8H39.8Z" },
  { region: "abs", d: "M35.6 80 38.8 81.6V98.4L35.2 92C34.2 90.2 34.6 84 35.6 80Z" },
  { region: "abs", d: "M39.8 92.8H46.6V98L42.6 106.4C41.2 109.2 39.8 108.4 39.8 105.6Z" },
  // Biceps and forearm, read together as the arm.
  { region: "arms", d: "M20.4 47.4C23.8 45 27.2 45.4 29.4 48.6L30.8 74.6C31 78.4 28.8 80.4 25.4 80.4 22 80.4 20 78.4 19.8 74.6L18.9 53.4C18.75 50.2 19.3 48.2 20.4 47.4Z" },
  { region: "arms", d: "M20.5 81.2C23.4 80 26.4 80.2 29 81.8L30.3 104.4C30.5 107.4 28.9 109 25.9 109 22.9 109 21.2 107.4 21 104.4Z" },
  // Quadriceps and calf.
  { region: "legs", d: "M33.6 105.4C38.4 103 43.2 103 47 105.4L46.4 135.8C46.3 140 44 142 39.9 142 35.8 142 33.6 140 33.5 135.8L32.8 114C32.75 109.8 33 106.6 33.6 105.4Z" },
  { region: "legs", d: "M35.8 141.6C39.4 140.2 43 140.2 46.2 141.6L45.6 162.6C45.5 166 43.6 167.6 40.9 167.6 38.2 167.6 36.4 166 36.3 162.6Z" },
];

/**
 * The figure, with everything the session worked lit up.
 *
 * The old drawing was a stick outline about an eighth of the card tall, and at
 * that size nobody could tell a chest day from a leg day — which is the one
 * question it exists to answer. This one is built the way an anatomy chart is:
 * a quiet body with the muscle groups laid over it as separate plates, so a
 * worked group is a solid block of brand colour against a body that is barely
 * there, and it reads at a glance from a story feed.
 *
 * Drawn rather than photographed so it scales, recolours and needs no asset
 * pipeline — and so the card the app previews and the file the server renders
 * really are the same picture.
 */
const bodyDiagram = (muscles: string[], x: number, y: number, height: number): string => {
  const worked = new Set(muscles.map(regionFor).filter((region): region is MuscleRegion => Boolean(region)));
  const scale = height / BODY_GRID_HEIGHT;

  const plate = ({ d, region }: (typeof BODY_MUSCLES)[number]): string =>
    worked.has(region)
      ? `<path d="${d}" fill="${SHARE_CARD_COLORS.accentEnd}" opacity="0.97"/>`
      : `<path d="${d}" fill="#FFFFFF" opacity="0.2"/>`;

  // One opacity on the group, not on each path: the limbs overlap where they
  // join, and per-path transparency turned every one of those joins into a
  // visible darker seam.
  const mirror = (markup: string): string =>
    `<g transform="translate(96 0) scale(-1 1)">${NEWLINE}${markup}${NEWLINE}</g>`;

  const outline = BODY_SILHOUETTE.map((d) => `<path d="${d}"/>`).join(NEWLINE);
  // One opacity, applied once to both halves together. Two half-groups meeting
  // at the spine composited their transparency twice and drew a dark stripe
  // straight down the middle of the body.
  const silhouette = `<g fill="#FFFFFF" opacity="0.11">${NEWLINE}${outline}${NEWLINE}${mirror(outline)}${NEWLINE}</g>`;
  const plates = BODY_MUSCLES.map(plate).join(NEWLINE);

  // The grid is wider than the body so the paths could be written about a
  // round-numbered spine; the empty margin is trimmed here instead, which is
  // what lets a caller place the figure by its real right edge.
  return `<g transform="translate(${x - BODY_LEFT * scale} ${y}) scale(${scale})">
${silhouette}
${plates}
${mirror(plates)}
</g>`;
};

/**
 * The little drawing beside an exercise, telling you what it was done with.
 *
 * Line art on a 24-unit grid, matching the pickers inside the app. Deliberately
 * not the exercise's own photograph: those live on a CDN, and neither the app's
 * SVG renderer nor the server's fetches a remote image mid-render.
 */
const EQUIPMENT_PATHS: Record<string, string> = {
  barbell:
    "M2 12h20M5.6 7.6v8.8M8.2 9.2v5.6M15.8 9.2v5.6M18.4 7.6v8.8",
  dumbbell:
    "M9 12h6M6.6 7.4v9.2M17.4 7.4v9.2M3.4 9.6v4.8M20.6 9.6v4.8",
  machine:
    "M5 5h8v14H5zM7 9h4M7 12h4M7 15h4M15 7h4v10",
  cables:
    "M7 4v4M7 8h9v5M16 13v4M13 17.5h6",
  kettlebell:
    "M9.4 8a2.6 2.6 0 0 1 5.2 0M9.6 8.6C7.1 10 5.6 12.5 5.6 15.2c0 2.4 1.4 3.9 3.7 3.9h5.4c2.3 0 3.7-1.5 3.7-3.9 0-2.7-1.5-5.2-4-6.6",
  band:
    "M6.4 8.4C11 10.4 13 13.6 17.6 15.6M6.4 11.4C11 13.4 13 14.4 17.6 16.4",
  plate:
    "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16M12 9.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8",
  bodyweight:
    "M12 6.9v6M12 12.9 8.4 20M12 12.9 15.6 20M5.4 9.4 12 8.4l6.6 1M12 2.2a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4",
  other: "M6 12h.01M12 12h.01M18 12h.01",
};

const EQUIPMENT_ALIASES: Record<string, string> = {
  bar: "barbell", ez_bar: "barbell", "olympic barbell": "barbell", "ez barbell": "barbell",
  "smith machine": "machine", "leverage machine": "machine", "sled machine": "machine",
  cable: "cables",
  bands: "band", resistance_band: "band", "resistance band": "band",
  "body weight": "bodyweight", body_weight: "bodyweight", none: "bodyweight", assisted: "bodyweight",
  weighted: "plate", "weight plate": "plate",
  suspension: "bodyweight", trx: "bodyweight",
};

const equipmentGlyph = (equipment: string | undefined, x: number, y: number, size: number): string => {
  const key = (equipment ?? "").trim().toLowerCase().replace(/[_\s]+/g, " ");
  const name = EQUIPMENT_PATHS[key] ? key : EQUIPMENT_ALIASES[key] ?? "other";
  const scale = size / 24;
  return `<g transform="translate(${x} ${y}) scale(${scale})"><path d="${EQUIPMENT_PATHS[name]}" fill="none" stroke="${SHARE_CARD_COLORS.text}" stroke-opacity="0.72" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`;
};

interface Frame {
  width: number;
  height: number;
  /** Left edge of the content column. */
  left: number;
  /** Usable width inside the margins. */
  inner: number;
  /** Vertical middle of the card, where a single block is centred. */
  middle: number;
  /** Baseline of the brand row. */
  footer: number;
}

const frameFor = (size: ShareCardSize): Frame => {
  const { width, height } = SHARE_CARD_SIZES[size];
  const margin = Math.round(width * 0.085);
  return {
    width,
    height,
    left: margin,
    inner: width - margin * 2,
    middle: Math.round(height / 2),
    footer: height - margin,
  };
};

type TemplateRenderer = (data: ShareCardData, frame: Frame) => string;

/** Title, a body diagram, the numbers, then what was actually done. */
const renderSummary: TemplateRenderer = (data, frame) => {
  const stats = data.stats.slice(0, 3);
  const rowHeight = 84;
  const ceiling = Math.round(frame.height * 0.12);
  const floor = frame.footer - 120;
  const muscles = data.muscles ?? [];

  /* The figure stands beside the numbers, so the two together are one band
     rather than the diagram costing the card a whole section of its own. It is
     the second thing read after the title — what the session actually worked —
     so it is sized to be legible from a story feed, not tucked into a corner. */
  const diagramHeight = muscles.length ? Math.round(frame.height * 0.26) : 0;
  const diagramWidth = Math.round(diagramHeight * SHARE_CARD_BODY_ASPECT);
  const statsWidth = diagramWidth ? frame.inner - diagramWidth - 48 : frame.inner;
  const columnWidth = statsWidth / Math.max(stats.length, 1);

  const titleHeight = 88 + (data.subtitle ? 54 : 0);
  const bandHeight = Math.max(stats.length ? 150 : 0, diagramHeight);
  const maxRows = Math.max(
    1,
    Math.floor((floor - ceiling - titleHeight - bandHeight - 40) / rowHeight),
  );
  const rows = data.exercises.slice(0, maxRows);
  const blockHeight = titleHeight + bandHeight + 40 + rows.length * rowHeight;
  const top = Math.max(ceiling, Math.round((ceiling + floor - blockHeight) / 2));

  let cursor = top + 88;
  const parts = [text(clip(data.title, 20), { x: frame.left, y: cursor, size: 88, weight: 700, spacing: -2 })];

  if (data.subtitle) {
    cursor += 54;
    parts.push(
      text(clip(data.subtitle, 40), {
        x: frame.left,
        y: cursor,
        size: 34,
        weight: 500,
        fill: SHARE_CARD_COLORS.textMuted,
      }),
    );
  }

  const bandTop = cursor + 34;

  if (diagramHeight) {
    parts.push(
      bodyDiagram(muscles, frame.left + frame.inner - diagramWidth, bandTop, diagramHeight),
    );
  }

  if (stats.length) {
    // Set smaller than the title on purpose: the session is the headline and
    // the numbers are the detail under it, not the other way round.
    const valueSize = fittedValueSize(stats.map((stat) => stat.value), columnWidth, 50);
    const statsY = bandTop + Math.round(bandHeight / 2) - 10;
    parts.push(
      ...stats.map((stat, index) => statBlock(stat, frame.left + columnWidth * index, statsY, valueSize)),
    );
  }

  const listTop = bandTop + bandHeight + 40;
  rows.forEach((exercise, index) => {
    const y = listTop + 32 + rowHeight * index;
    parts.push(
      equipmentGlyph(exercise.equipment, frame.left, y - 32, 46),
      text(`${exercise.sets}x`, {
        x: frame.left + 66,
        y,
        size: 38,
        weight: 700,
        fill: SHARE_CARD_COLORS.accentEnd,
      }),
      text(clip(exercise.name, 21), { x: frame.left + 140, y, size: 38, weight: 500 }),
    );
  });

  parts.push(brandRow(frame.left, frame.footer, data.username, frame.inner));
  return parts.filter(Boolean).join("\n");
};

/** Only the numbers, stacked and centred. Reads from across a room. */
const renderStats: TemplateRenderer = (data, frame) => {
  const stats = data.stats.slice(0, 4);
  const gap = 200;
  const first = frame.middle - ((stats.length - 1) * gap) / 2 - 60;
  const centre = frame.width / 2;

  return [
    ...stats.map((stat, index) => statBlock(stat, centre, first + gap * index, 96, "middle")),
    brandRow(frame.left, frame.footer, data.username, frame.inner),
  ].join("\n");
};

/** The session as a list of movements, each with the kit it was done on. */
const renderExercises: TemplateRenderer = (data, frame) => {
  const rowHeight = 88;
  const ceiling = Math.round(frame.height * 0.14);
  const floor = frame.footer - 130;
  const muscles = data.muscles ?? [];
  const diagramHeight = muscles.length ? Math.round(frame.height * 0.22) : 0;
  const diagramWidth = Math.round(diagramHeight * SHARE_CARD_BODY_ASPECT);
  const header = 200 + (diagramHeight ? diagramHeight + 24 : 0);
  const maxRows = Math.max(1, Math.floor((floor - ceiling - header) / rowHeight));
  const rows = data.exercises.slice(0, maxRows);
  const blockHeight = header + rows.length * rowHeight;
  const top = Math.max(ceiling, Math.round((ceiling + floor - blockHeight) / 2));

  return [
    text(clip(data.title, 20), { x: frame.left, y: top + 92, size: 92, weight: 700, spacing: -2 }),
    diagramHeight
      ? bodyDiagram(muscles, frame.left + frame.inner - diagramWidth, top + 118, diagramHeight)
      : "",
    ...rows.map((exercise, index) => {
      const y = top + header + rowHeight * index;
      return [
        equipmentGlyph(exercise.equipment, frame.left, y - 32, 44),
        text(`${exercise.sets}x`, {
          x: frame.left + 64,
          y,
          size: 42,
          weight: 700,
          fill: SHARE_CARD_COLORS.accentEnd,
        }),
        text(clip(exercise.name, 20), { x: frame.left + 140, y, size: 42, weight: 500 }),
      ].join("\n");
    }),
    brandRow(frame.left, frame.footer, data.username, frame.inner),
  ]
    .filter(Boolean)
    .join("\n");
};

/** One number, as big as it will go. For a session worth bragging about. */
const renderHighlight: TemplateRenderer = (data, frame) => {
  const hero = data.stats[0];
  const rest = data.stats.slice(1, 3);
  const centre = frame.width / 2;

  return [
    text(clip(data.title, 24), {
      x: centre,
      y: frame.middle - 220,
      size: 52,
      weight: 600,
      anchor: "middle",
      fill: SHARE_CARD_COLORS.textMuted,
    }),
    hero
      ? [
          text(hero.value, {
            x: centre,
            y: frame.middle,
            size: 200,
            weight: 700,
            anchor: "middle",
            spacing: -6,
          }),
          text(hero.label.toUpperCase(), {
            x: centre,
            y: frame.middle + 80,
            size: 40,
            weight: 600,
            anchor: "middle",
            spacing: 4,
            fill: SHARE_CARD_COLORS.textMuted,
          }),
        ].join("\n")
      : "",
    ...rest.map((stat, index) =>
      statBlock(
        stat,
        centre + (index === 0 ? -220 : 220),
        frame.middle + 260,
        fittedValueSize(rest.map((entry) => entry.value), 420, 60),
        "middle",
      ),
    ),
    brandRow(frame.left, frame.footer, data.username, frame.inner),
  ]
    .filter(Boolean)
    .join("\n");
};

/** Title and mark, nothing else. The one that never fights a photo. */
const renderMinimal: TemplateRenderer = (data, frame) => [
  text(clip(data.title, 18), {
    x: frame.left,
    y: frame.middle,
    size: 110,
    weight: 700,
    spacing: -3,
  }),
  data.subtitle
    ? text(clip(data.subtitle, 40), {
        x: frame.left,
        y: frame.middle + 70,
        size: 40,
        weight: 500,
        fill: SHARE_CARD_COLORS.textMuted,
      })
    : "",
  brandRow(frame.left, frame.footer, data.username, frame.inner),
]
  .filter(Boolean)
  .join("\n");

const RENDERERS: Record<ShareCardTemplate, TemplateRenderer> = {
  summary: renderSummary,
  stats: renderStats,
  exercises: renderExercises,
  highlight: renderHighlight,
  minimal: renderMinimal,
};

/**
 * Draws one share card.
 *
 * With `overPhoto`, the ground is left transparent under a gradient scrim so the
 * caller can composite the result over a picture — the Strava arrangement,
 * where the photo is still the thing being shared. Without it, the card is the
 * brand plate.
 */
export const buildShareCardSvg = (
  data: ShareCardData,
  template: ShareCardTemplate = "summary",
  size: ShareCardSize = "story",
): string => {
  const frame = frameFor(size);
  const render = RENDERERS[template] ?? renderSummary;

  // Over a photo the ground is the photo, so only the scrim that keeps the type
  // readable is drawn; everywhere else the card is the brand plate.
  const background = data.overPhoto
    ? `<rect width="${frame.width}" height="${frame.height}" fill="url(#mmScrim)"/>`
    : `<rect width="${frame.width}" height="${frame.height}" fill="url(#mmPlate)"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}" viewBox="0 0 ${frame.width} ${frame.height}">
<defs>
<linearGradient id="mmPlate" x1="0" y1="0" x2="${frame.width}" y2="${frame.height}" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="${SHARE_CARD_COLORS.plateTop}"/>
<stop offset=".5" stop-color="${SHARE_CARD_COLORS.plateMiddle}"/>
<stop offset="1" stop-color="${SHARE_CARD_COLORS.plateBottom}"/>
</linearGradient>
<linearGradient id="mmAccent" x1="96" y1="128" x2="416" y2="384" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="${SHARE_CARD_COLORS.accentStart}"/>
<stop offset=".55" stop-color="${SHARE_CARD_COLORS.accentMiddle}"/>
<stop offset="1" stop-color="${SHARE_CARD_COLORS.accentEnd}"/>
</linearGradient>
<linearGradient id="mmScrim" x1="0" y1="0" x2="0" y2="${frame.height}" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#05070D" stop-opacity=".72"/>
<stop offset=".42" stop-color="#05070D" stop-opacity=".22"/>
<stop offset="1" stop-color="#05070D" stop-opacity=".82"/>
</linearGradient>
</defs>
${background}
${render(data, frame)}
</svg>`;
};

/**
 * The caption that travels with the card.
 *
 * Kept next to the renderer because it says the same things the picture does,
 * and the two should never disagree about the numbers.
 */
export const buildShareCardText = (data: ShareCardData, url?: string): string =>
  [
    data.title,
    data.stats.map((stat) => `${stat.label}: ${stat.value}`).join(" · "),
    url,
    "MotionMeet",
  ]
    .filter(Boolean)
    .join("\n");

/* ── Turning a workout into card data ─────────────────────────────────────── */

/** Minutes the way a person says them: "48 dk", or "1 sa 12 dk" past the hour. */
export const formatShareDuration = (minutes: number): string => {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} dk`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest ? `${hours} sa ${rest} dk` : `${hours} sa`;
};

/** Volume rounded to something readable, and switched to tonnes past 1000 kg. */
export const formatShareVolume = (kilograms: number): string => {
  const value = Math.round(kilograms);
  if (value < 1000) return `${value} kg`;
  return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)} t`;
};

export const formatShareDate = (iso: string, locale = "tr-TR"): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(date);
};

/** The minimum a workout has to expose for a card to be built from it. */
export interface ShareCardWorkoutLike {
  name: string;
  startTime: string;
  durationMinutes: number;
  volumeKg: number;
  totalSets: number;
  exercises: Array<{
    exerciseName: string;
    sets: unknown[];
    equipment?: string;
    muscleGroup?: string;
  }>;
}

export interface ShareCardLabels {
  duration: string;
  volume: string;
  sets: string;
  untitled: string;
}

export const DEFAULT_SHARE_CARD_LABELS: ShareCardLabels = {
  duration: "Süre",
  volume: "Hacim",
  sets: "Set",
  untitled: "Antrenman",
};

/**
 * Builds the card's contents from a finished workout.
 *
 * Shared so the preview the app draws and the file the server rasterises are
 * built from one function: same rounding, same wording, same order. A card
 * whose numbers shift between the picker and the download would be worse than
 * no card at all.
 */
export const workoutToShareCardData = (
  workout: ShareCardWorkoutLike,
  username: string,
  labels: ShareCardLabels = DEFAULT_SHARE_CARD_LABELS,
  locale = "tr-TR",
): ShareCardData => ({
  title: workout.name?.trim() || labels.untitled,
  username: username || "motionmeet",
  subtitle: formatShareDate(workout.startTime, locale),
  stats: [
    { label: labels.duration, value: formatShareDuration(workout.durationMinutes) },
    { label: labels.volume, value: formatShareVolume(workout.volumeKg) },
    { label: labels.sets, value: String(workout.totalSets) },
  ],
  exercises: workout.exercises.map((exercise) => ({
    sets: exercise.sets.length,
    name: exercise.exerciseName,
    equipment: exercise.equipment,
    muscleGroup: exercise.muscleGroup,
  })),
  // Every distinct muscle the session touched, so the figure shades all of
  // them rather than only whatever the first movement happened to work.
  muscles: [
    ...new Set(
      workout.exercises
        .map((exercise) => exercise.muscleGroup)
        .filter((group): group is string => Boolean(group && group.trim())),
    ),
  ],
});
