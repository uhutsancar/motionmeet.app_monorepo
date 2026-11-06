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
import { BODY_FIGURE_ASPECT, bodyFigureSvg, regionsForMuscles } from "./bodyFigure.js";

/** Every layout the picker offers, in the order it shows them. */
export const SHARE_CARD_TEMPLATES = [
  "summary",
  "stats",
  "exercises",
  "highlight",
  "minimal",
] as const;
export type ShareCardTemplate = (typeof SHARE_CARD_TEMPLATES)[number];

/**
 * Bumped whenever the drawing changes, so a file cached by an earlier version
 * is never handed out as if it were the card on screen.
 */
export const SHARE_CARD_DESIGN_VERSION = 2;

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
  /** Which number this is, so a template can pick the one worth featuring. */
  key?: "duration" | "volume" | "sets" | (string & {});
  /** The raw amount behind `value`; zero or less means "nothing to feature". */
  amount?: number;
}

export interface ShareCardExercise {
  /** How many sets were logged, rendered as the "3×" figure. */
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
  /** Shown beside the mark; the "@" is added here, not by the caller. */
  username: string;
  stats: ShareCardStat[];
  exercises: ShareCardExercise[];
  /** Optional line over the title: a date, a place, anything short. */
  subtitle?: string;
  /**
   * Muscle codes to shade on the body figure.
   *
   * Derived from the workout's exercises rather than asked for: a chest day
   * shades the chest. When none of them is a code the figure knows, the figure
   * is left out entirely rather than drawn as an empty, meaningless body.
   */
  muscles?: string[];
  /** "+{count} more" in the card's language, for a list that does not fit. */
  moreExercisesLabel?: string;
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
  plateTop: "#16203A",
  plateMiddle: "#0D1424",
  plateBottom: "#060A13",
  accentStart: "#3B82F6",
  accentMiddle: "#2FA9F4",
  accentEnd: "#22D3EE",
  text: "#F5F7FB",
  textMuted: "rgba(245,247,251,0.62)",
  textFaint: "rgba(245,247,251,0.42)",
  hairline: "rgba(245,247,251,0.14)",
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
 * place everywhere. Counted in code points, so an emoji is never cut in half.
 */
const clip = (value: string, max: number): string => {
  const chars = Array.from(value.trim());
  return chars.length <= max ? chars.join("") : `${chars.slice(0, max - 1).join("").trimEnd()}…`;
};

/**
 * Breaks a headline into at most `maxLines` lines of `perLine` characters,
 * on word boundaries, with an ellipsis on the last line if anything was left.
 */
const wrapText = (value: string, perLine: number, maxLines: number): string[] => {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let index = 0;
  while (index < words.length && lines.length < maxLines) {
    let line = words[index++];
    while (index < words.length && Array.from(`${line} ${words[index]}`).length <= perLine) {
      line = `${line} ${words[index++]}`;
    }
    lines.push(line);
  }
  if (index < words.length && lines.length) lines[lines.length - 1] += "…";
  return lines.map((line) => clip(line, perLine));
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

/** A grotesque's average advance, as a fraction of the size, for fitting. */
const ADVANCE = 0.6;

interface TextOptions {
  x: number;
  y: number;
  size: number;
  weight?: number;
  fill?: string;
  anchor?: "start" | "middle" | "end";
  spacing?: number;
}

const text = (value: string, options: TextOptions, inner = ""): string => {
  const { x, y, size, weight = 400, fill = SHARE_CARD_COLORS.text, anchor = "start", spacing = 0 } = options;
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${spacing}">${escapeXml(value)}${inner}</text>`;
};

const hairline = (x: number, y: number, width: number): string =>
  `<rect x="${x}" y="${y}" width="${width}" height="2" fill="${SHARE_CARD_COLORS.hairline}"/>`;

/** The mark, drawn at any size, from the same path as `brand/`. */
const mark = (x: number, y: number, size: number, stroke = "url(#mmAccent)", opacity = 1): string => {
  const scale = size / 512;
  return `<g transform="translate(${x} ${y}) scale(${scale})" opacity="${opacity}">
<path d="M112 380V166l144 138 144-138v214" fill="none" stroke="${stroke}" stroke-width="62" stroke-linecap="round" stroke-linejoin="round"/>
</g>`;
};

/* ── Layout ───────────────────────────────────────────────────────────────── */

interface Frame {
  width: number;
  height: number;
  /** Left edge and usable width of the content column. */
  left: number;
  inner: number;
  /** First line any content may sit on, and the brand row's baseline. */
  top: number;
  footer: number;
  /** The square: less height, so fewer rows and smaller type. */
  compact: boolean;
}

/**
 * Story apps lay their own controls over the top and bottom of a story - the
 * progress bar and profile row above, the reply field below - so on the story
 * size the card keeps its content clear of both.
 */
const frameFor = (size: ShareCardSize): Frame => {
  const { width, height } = SHARE_CARD_SIZES[size];
  const left = 88;
  return size === "story"
    ? { width, height, left, inner: width - left * 2, top: 268, footer: 1660, compact: false }
    : { width, height, left, inner: width - left * 2, top: 112, footer: 1000, compact: true };
};

/** Mark plus wordmark plus handle — the footer every template shares. */
const brandRow = (frame: Frame, username: string): string => {
  const markSize = 54;
  const y = frame.footer;
  return [
    mark(frame.left - 6, y - markSize + 9, markSize),
    text("MotionMeet", { x: frame.left + markSize + 10, y, size: 36, weight: 700, spacing: -0.4 }),
    text(`@${clip(username, 22)}`, {
      x: frame.left + frame.inner,
      y,
      size: 32,
      weight: 500,
      anchor: "end",
      fill: SHARE_CARD_COLORS.textMuted,
    }),
  ].join("\n");
};

/** "360 kg" → 360 + kg, so the number can be set large and the unit small. */
const splitValue = (value: string): { amount: string; unit: string } => {
  const match = /^([<>~]?[\d.,]+)\s+([^\d\s][^\d]*)$/u.exec(value.trim());
  return match ? { amount: match[1], unit: match[2] } : { amount: value.trim(), unit: "" };
};

const UNIT_RATIO = 0.42;

/** Estimated drawn width of a value with its unit, for fitting a column. */
const valueWidth = (value: string, size: number): number => {
  const { amount, unit } = splitValue(value);
  const unitWidth = unit ? (Array.from(unit).length + 0.6) * ADVANCE * size * UNIT_RATIO : 0;
  return Array.from(amount).length * ADVANCE * size + unitWidth;
};

/** The largest size, up to `preferred`, at which every value fits `width`. */
const fitSize = (values: string[], width: number, preferred: number, floor = 30): number => {
  const widest = Math.max(1, ...values.map((value) => valueWidth(value, 1)));
  return Math.max(floor, Math.min(preferred, Math.floor(width / widest)));
};

/** A value with its unit set smaller and quieter beside it. */
const valueText = (value: string, options: TextOptions): string => {
  const { amount, unit } = splitValue(value);
  const unitMarkup = unit
    ? `<tspan dx="${Math.round(options.size * 0.12)}" font-size="${Math.round(options.size * UNIT_RATIO)}" font-weight="600" fill="${SHARE_CARD_COLORS.textMuted}">${escapeXml(unit)}</tspan>`
    : "";
  return text(amount, { weight: 700, spacing: -1, ...options }, unitMarkup);
};

const labelText = (value: string, options: TextOptions): string =>
  text(value.toLocaleUpperCase(), {
    weight: 700,
    spacing: 3,
    fill: SHARE_CARD_COLORS.textFaint,
    ...options,
  });

/** One stat: the value over a small capitalised label. Returns its markup. */
const statBlock = (stat: ShareCardStat, x: number, baseline: number, size: number, anchor: TextOptions["anchor"] = "start"): string =>
  [
    valueText(stat.value, { x, y: baseline, size, anchor }),
    labelText(stat.label, { x, y: baseline + Math.max(30, size * 0.46), size: Math.max(22, Math.round(size * 0.3)), anchor }),
  ].join("\n");

/** Height a statBlock takes from the value's cap height to the label's baseline. */
const statBlockHeight = (size: number): number => size * 0.74 + Math.max(30, size * 0.46);

/** Stats side by side, divided by hairlines. */
const statRow = (stats: ShareCardStat[], x: number, top: number, width: number, preferred: number): { markup: string; bottom: number } => {
  if (!stats.length) return { markup: "", bottom: top };
  const column = width / stats.length;
  const size = fitSize(stats.map((stat) => stat.value), column - 28, preferred);
  const baseline = top + Math.round(size * 0.74);
  const markup = stats.map((stat, index) => [
    index ? `<rect x="${Math.round(x + column * index - 16)}" y="${top - 4}" width="2" height="${Math.round(statBlockHeight(size) + 8)}" fill="${SHARE_CARD_COLORS.hairline}"/>` : "",
    statBlock(stat, Math.round(x + column * index + (index ? 12 : 0)), baseline, size),
  ].join("\n"));
  return { markup: markup.join("\n"), bottom: top + statBlockHeight(size) };
};

/** Stats stacked one over another. */
const statStack = (stats: ShareCardStat[], x: number, top: number, width: number, preferred: number, gap: number): { markup: string; bottom: number } => {
  if (!stats.length) return { markup: "", bottom: top };
  const size = fitSize(stats.map((stat) => stat.value), width, preferred);
  const step = statBlockHeight(size) + gap;
  const markup = stats.map((stat, index) => statBlock(stat, x, top + Math.round(size * 0.74 + step * index), size));
  return { markup: markup.join("\n"), bottom: top + step * stats.length - gap };
};

/** Date over headline. Returns the markup and the y the next block may start at. */
const header = (
  data: ShareCardData,
  frame: Frame,
  top: number,
  options: { size: number; perLine: number; maxLines: number; width?: number },
): { markup: string; bottom: number } => {
  const parts: string[] = [];
  let y = top;
  if (data.subtitle) {
    const eyebrow = Math.max(26, Math.round(options.size * 0.3));
    y += eyebrow;
    parts.push(text(clip(data.subtitle, 34).toLocaleUpperCase(), {
      x: frame.left,
      y,
      size: eyebrow,
      weight: 700,
      spacing: 4,
      fill: SHARE_CARD_COLORS.accentEnd,
    }));
    y += Math.max(18, Math.round(options.size * 0.3));
  }
  const lines = wrapText(data.title, options.perLine, options.maxLines);
  lines.forEach((line, index) => {
    y += Math.round(options.size * (index ? 1.04 : 0.86));
    parts.push(text(line, { x: frame.left, y, size: options.size, weight: 800, spacing: -2 }));
  });
  return { markup: parts.join("\n"), bottom: y + Math.round(options.size * 0.3) };
};

/* ── Drawings ─────────────────────────────────────────────────────────────── */

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

/** The equipment drawing on a soft disc, `size` across, centred on (cx, cy). */
const equipmentBadge = (equipment: string | undefined, cx: number, cy: number, size: number): string => {
  const key = (equipment ?? "").trim().toLowerCase().replace(/[_\s]+/g, " ");
  const name = EQUIPMENT_PATHS[key] ? key : EQUIPMENT_ALIASES[key] ?? "other";
  const glyph = size * 0.56;
  const scale = glyph / 24;
  return `<circle cx="${cx}" cy="${cy}" r="${size / 2}" fill="#FFFFFF" fill-opacity="0.07"/>
<g transform="translate(${cx - glyph / 2} ${cy - glyph / 2}) scale(${scale})"><path d="${EQUIPMENT_PATHS[name]}" fill="none" stroke="${SHARE_CARD_COLORS.text}" stroke-opacity="0.85" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>`;
};

/**
 * The movements, one per row, with the sets on the right. Rows that do not
 * fit are not dropped silently: the last row says how many more there were.
 */
const exerciseList = (
  data: ShareCardData,
  frame: Frame,
  top: number,
  width: number,
  maxRows: number,
  options: { size: number; rowHeight: number },
): { markup: string; bottom: number } => {
  const total = data.exercises.length;
  if (!total || maxRows < 1) return { markup: "", bottom: top };
  const overflow = total > maxRows;
  const shown = data.exercises.slice(0, overflow ? Math.max(0, maxRows - 1) : total);
  const { size, rowHeight } = options;
  const badge = Math.round(rowHeight * 0.68);
  const nameX = frame.left + badge + 26;
  const perLine = Math.max(8, Math.floor((width - badge - 26 - size * 2.6) / (size * 0.56)));

  const rows = shown.map((exercise, index) => {
    const middle = top + rowHeight * index + rowHeight / 2;
    return [
      index ? hairline(nameX, Math.round(top + rowHeight * index), frame.left + width - nameX) : "",
      equipmentBadge(exercise.equipment, frame.left + badge / 2, middle, badge),
      text(clip(exercise.name, perLine), { x: nameX, y: Math.round(middle + size * 0.36), size, weight: 600 }),
      text(`${exercise.sets}×`, {
        x: frame.left + width,
        y: Math.round(middle + size * 0.36),
        size,
        weight: 700,
        anchor: "end",
        fill: SHARE_CARD_COLORS.accentEnd,
      }),
    ].join("\n");
  });

  if (overflow) {
    const rest = total - shown.length;
    const middle = top + rowHeight * shown.length + rowHeight / 2;
    const label = (data.moreExercisesLabel ?? "+{count}").replace("{count}", String(rest));
    rows.push([
      shown.length ? hairline(nameX, Math.round(top + rowHeight * shown.length), frame.left + width - nameX) : "",
      text(label, { x: nameX, y: Math.round(middle + size * 0.36), size: Math.round(size * 0.9), weight: 600, fill: SHARE_CARD_COLORS.textMuted }),
    ].join("\n"));
  }
  return { markup: rows.join("\n"), bottom: top + rowHeight * rows.length };
};

/** Whether the figure would show anything: a body with nothing lit says nothing. */
const hasFigure = (data: ShareCardData): boolean => regionsForMuscles(data.muscles ?? []).size > 0;

const figure = (data: ShareCardData, x: number, y: number, height: number): string =>
  bodyFigureSvg(data.muscles ?? [], { x, y, height });

/**
 * The number a "highlight" card features: the volume if anything was lifted,
 * then the time, then the sets. Never a zero - "0 kg" is not a highlight.
 */
const featuredStat = (stats: ShareCardStat[]): ShareCardStat | undefined => {
  const usable = stats.filter((stat) => stat.amount === undefined || stat.amount > 0);
  const byKey = (key: string) => usable.find((stat) => stat.key === key);
  return byKey("volume") ?? byKey("duration") ?? byKey("sets") ?? usable[0];
};

type TemplateRenderer = (data: ShareCardData, frame: Frame) => string;

/** Centres a block of `height` between the header's bottom and the footer. */
const centredTop = (from: number, to: number, height: number): number =>
  Math.round(from + Math.max(0, (to - from - height) / 2));

/* ── Templates ────────────────────────────────────────────────────────────── */

/** Headline, then the body and the numbers side by side, then the movements. */
const renderSummary: TemplateRenderer = (data, frame) => {
  const stats = data.stats.slice(0, 3);
  const withFigure = hasFigure(data);
  const head = header(data, frame, frame.top, frame.compact
    ? { size: 80, perLine: 20, maxLines: 1 }
    : { size: 104, perLine: 15, maxLines: 2 });
  const floor = frame.footer - (frame.compact ? 84 : 120);
  const parts = [head.markup];

  if (withFigure) {
    const figureHeight = frame.compact ? Math.min(560, floor - head.bottom - 24) : 600;
    const figureWidth = Math.round(figureHeight * BODY_FIGURE_ASPECT.both);
    const column = frame.inner - figureWidth - 40;
    const rowHeight = frame.compact ? 70 : 88;
    const listRows = frame.compact ? 0 : Math.floor((floor - head.bottom - 48 - figureHeight - 40) / rowHeight);
    const bandTop = centredTop(head.bottom + 24, floor, figureHeight + (listRows > 0 ? 40 + rowHeight * Math.min(listRows, data.exercises.length) : 0));
    parts.push(figure(data, frame.left + frame.inner - figureWidth, bandTop, figureHeight));

    const stack = statStack(stats, frame.left, bandTop + 16, column, frame.compact ? 76 : 112, frame.compact ? 40 : 64);
    parts.push(stack.markup);
    if (frame.compact) {
      // The square has no room under the figure, so the movements share the
      // column the numbers stand in.
      const rowsLeft = Math.floor((bandTop + figureHeight - stack.bottom - 36) / 64);
      parts.push(exerciseList(data, frame, stack.bottom + 36, column, rowsLeft, { size: 30, rowHeight: 64 }).markup);
    } else {
      parts.push(exerciseList(data, frame, bandTop + figureHeight + 40, frame.inner, listRows, { size: 38, rowHeight }).markup);
    }
  } else {
    const rowHeight = frame.compact ? 72 : 92;
    const row = statRow(stats, frame.left, head.bottom + 40, frame.inner, frame.compact ? 76 : 96);
    const rows = Math.floor((floor - row.bottom - 56) / rowHeight);
    const top = centredTop(head.bottom + 40, floor, row.bottom - head.bottom - 40 + 56 + rowHeight * Math.min(rows, data.exercises.length));
    const placed = statRow(stats, frame.left, top, frame.inner, frame.compact ? 76 : 96);
    parts.push(placed.markup);
    parts.push(exerciseList(data, frame, placed.bottom + 56, frame.inner, rows, { size: frame.compact ? 32 : 40, rowHeight }).markup);
  }

  parts.push(brandRow(frame, data.username));
  return parts.filter(Boolean).join("\n");
};

/** The numbers, big and stacked, each over its label. Reads from across a room. */
const renderStats: TemplateRenderer = (data, frame) => {
  const stats = data.stats.slice(0, 3);
  if (!stats.length) return renderMinimal(data, frame);
  const head = header(data, frame, frame.top, frame.compact
    ? { size: 56, perLine: 28, maxLines: 1 }
    : { size: 68, perLine: 22, maxLines: 2 });
  const floor = frame.footer - (frame.compact ? 70 : 110);
  const preferred = frame.compact ? 120 : 190;
  const gap = frame.compact ? 44 : 84;
  const size = fitSize(stats.map((stat) => stat.value), frame.inner, preferred);
  const blockHeight = (statBlockHeight(size) + gap) * stats.length - gap;
  const top = centredTop(head.bottom + 30, floor, blockHeight);

  const parts = [head.markup];
  stats.forEach((stat, index) => {
    const blockTop = top + (statBlockHeight(size) + gap) * index;
    if (index) parts.push(hairline(frame.left, Math.round(blockTop - gap / 2), frame.inner));
    parts.push(statBlock(stat, frame.left, Math.round(blockTop + size * 0.74), size));
  });
  parts.push(brandRow(frame, data.username));
  return parts.join("\n");
};

/** The session as a list of movements, each with the kit it was done on. */
const renderExercises: TemplateRenderer = (data, frame) => {
  const floor = frame.footer - (frame.compact ? 70 : 110);
  const rowHeight = frame.compact ? 78 : 100;
  const listOptions = { size: frame.compact ? 34 : 42, rowHeight };
  const gap = frame.compact ? 28 : 56;
  const parts: string[] = [];

  if (!data.exercises.length) {
    const head = header(data, frame, frame.top, { size: frame.compact ? 72 : 92, perLine: frame.compact ? 22 : 17, maxLines: 2 });
    parts.push(head.markup, statRow(data.stats.slice(0, 3), frame.left, head.bottom + gap, frame.inner, 88).markup);
    parts.push(brandRow(frame, data.username));
    return parts.join("\n");
  }

  // A short session leaves room under its list, and that room goes to a large
  // figure; a long one keeps the room for rows and tucks a small figure in
  // beside the headline instead.
  const fullHead = header(data, frame, frame.top, frame.compact
    ? { size: 72, perLine: 22, maxLines: 1 }
    : { size: 92, perLine: 17, maxLines: 2 });
  const fullTop = fullHead.bottom + gap;
  const rows = Math.min(data.exercises.length, Math.floor((floor - fullTop) / rowHeight));
  const spare = floor - fullTop - rows * rowHeight;

  if (hasFigure(data) && spare >= (frame.compact ? 300 : 440)) {
    const figureHeight = Math.min(spare - gap, frame.compact ? 380 : 640);
    const figureWidth = Math.round(figureHeight * BODY_FIGURE_ASPECT.both);
    const listBottom = fullTop + rows * rowHeight;
    parts.push(fullHead.markup);
    parts.push(exerciseList(data, frame, fullTop, frame.inner, rows, listOptions).markup);
    parts.push(figure(data, Math.round(frame.left + (frame.inner - figureWidth) / 2), centredTop(listBottom + gap / 2, floor, figureHeight), figureHeight));
  } else if (hasFigure(data) && !frame.compact) {
    const figureHeight = 300;
    const figureWidth = Math.round(figureHeight * BODY_FIGURE_ASPECT.both);
    const head = header(data, frame, frame.top, { size: 92, perLine: 10, maxLines: 3 });
    const listTop = Math.max(head.bottom, frame.top + figureHeight) + gap;
    parts.push(head.markup, figure(data, frame.left + frame.inner - figureWidth, frame.top, figureHeight));
    parts.push(exerciseList(data, frame, listTop, frame.inner, Math.floor((floor - listTop) / rowHeight), listOptions).markup);
  } else {
    parts.push(fullHead.markup);
    parts.push(exerciseList(data, frame, fullTop, frame.inner, Math.floor((floor - fullTop) / rowHeight), listOptions).markup);
  }
  parts.push(brandRow(frame, data.username));
  return parts.join("\n");
};

/** One real number, as big as it will go, with the rest beneath it. */
const renderHighlight: TemplateRenderer = (data, frame) => {
  const hero = featuredStat(data.stats);
  if (!hero) return renderMinimal(data, frame);
  const rest = data.stats.filter((stat) => stat !== hero).slice(0, 2);
  const head = header(data, frame, frame.top, frame.compact
    ? { size: 56, perLine: 28, maxLines: 1 }
    : { size: 68, perLine: 22, maxLines: 2 });
  const floor = frame.footer - (frame.compact ? 70 : 110);

  const heroSize = fitSize([hero.value], frame.inner, frame.compact ? 230 : 300, 90);
  const labelSize = frame.compact ? 30 : 36;
  const restHeight = rest.length ? 60 + statBlockHeight(frame.compact ? 60 : 72) : 0;
  const blockHeight = labelSize + 28 + heroSize * 0.74 + restHeight;
  const top = centredTop(head.bottom + 30, floor, blockHeight);

  const parts = [head.markup];
  parts.push(labelText(hero.label, { x: frame.left, y: top + labelSize, size: labelSize, fill: SHARE_CARD_COLORS.accentEnd }));
  const heroBaseline = Math.round(top + labelSize + 28 + heroSize * 0.74);
  parts.push(valueText(hero.value, { x: frame.left - Math.round(heroSize * 0.04), y: heroBaseline, size: heroSize, spacing: -Math.round(heroSize * 0.03) }));
  if (rest.length) {
    const rowTop = heroBaseline + 60;
    parts.push(hairline(frame.left, rowTop - 30, frame.inner));
    parts.push(statRow(rest, frame.left, rowTop, frame.inner * (rest.length === 1 ? 0.5 : 1), frame.compact ? 60 : 72).markup);
  }
  parts.push(brandRow(frame, data.username));
  return parts.join("\n");
};

/**
 * The headline set big at the foot of the card, a quiet line of numbers and
 * the mark drawn large and faint above. The one that never fights a photo.
 */
const renderMinimal: TemplateRenderer = (data, frame) => {
  const size = frame.compact ? 104 : 136;
  const lines = wrapText(data.title, frame.compact ? 14 : 11, frame.compact ? 2 : 3);
  const inline = data.stats
    .filter((stat) => stat.amount === undefined || stat.amount > 0)
    .slice(0, 3)
    // A bare "26" says nothing on its own, so a unitless number keeps its label.
    .map((stat) => (splitValue(stat.value).unit || /[^\d.,<>~\s]/u.test(stat.value) ? stat.value : `${stat.value} ${stat.label.toLocaleLowerCase()}`))
    .join("  ·  ");
  const statsSize = frame.compact ? 32 : 38;
  const bottom = frame.footer - (frame.compact ? 100 : 150);
  const titleBottom = inline ? bottom - statsSize - 34 : bottom;
  const firstBaseline = titleBottom - Math.round(size * 1.02 * (lines.length - 1));

  const parts = [
    // The mark, drawn large and faint, gives the empty top of the card a shape
    // without adding anything else to read.
    mark(frame.left + frame.inner - (frame.compact ? 380 : 560), frame.top - (frame.compact ? 40 : 10), frame.compact ? 420 : 620, "#FFFFFF", 0.06),
  ];
  if (data.subtitle) {
    parts.push(text(clip(data.subtitle, 34).toLocaleUpperCase(), {
      x: frame.left,
      y: firstBaseline - size - 8,
      size: Math.round(size * 0.24),
      weight: 700,
      spacing: 4,
      fill: SHARE_CARD_COLORS.accentEnd,
    }));
  }
  lines.forEach((line, index) => {
    parts.push(text(line, { x: frame.left - 4, y: firstBaseline + Math.round(size * 1.02 * index), size, weight: 800, spacing: -3 }));
  });
  if (inline) {
    parts.push(text(inline, { x: frame.left, y: bottom, size: statsSize, weight: 600, fill: SHARE_CARD_COLORS.textMuted }));
  }
  parts.push(brandRow(frame, data.username));
  return parts.join("\n");
};

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
  // readable is drawn; everywhere else the card is the brand plate, with a
  // soft glow of the accent behind the content so it is not a flat fill.
  const background = data.overPhoto
    ? `<rect width="${frame.width}" height="${frame.height}" fill="url(#mmScrim)"/>`
    : `<rect width="${frame.width}" height="${frame.height}" fill="url(#mmPlate)"/>
<rect width="${frame.width}" height="${frame.height}" fill="url(#mmGlow)"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}" viewBox="0 0 ${frame.width} ${frame.height}">
<defs>
<linearGradient id="mmPlate" x1="0" y1="0" x2="${frame.width}" y2="${frame.height}" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="${SHARE_CARD_COLORS.plateTop}"/>
<stop offset=".5" stop-color="${SHARE_CARD_COLORS.plateMiddle}"/>
<stop offset="1" stop-color="${SHARE_CARD_COLORS.plateBottom}"/>
</linearGradient>
<radialGradient id="mmGlow" cx="${frame.width * 0.85}" cy="${frame.height * 0.08}" r="${frame.width * 0.9}" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="${SHARE_CARD_COLORS.accentStart}" stop-opacity=".22"/>
<stop offset="1" stop-color="${SHARE_CARD_COLORS.accentStart}" stop-opacity="0"/>
</radialGradient>
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

const isEnglish = (locale: string): boolean => locale.toLowerCase().startsWith("en");

/**
 * Minutes the way a person says them: "48 dk", or "1 sa 12 dk" past the hour.
 * A session under a minute is "<1 dk" rather than a misleading "0 dk".
 */
export const formatShareDuration = (minutes: number, locale = "tr-TR"): string => {
  const [min, hr] = isEnglish(locale) ? ["min", "h"] : ["dk", "sa"];
  if (!Number.isFinite(minutes) || minutes <= 0) return `0 ${min}`;
  if (minutes < 1) return `<1 ${min}`;
  const total = Math.round(minutes);
  if (total < 60) return `${total} ${min}`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest ? `${hours} ${hr} ${rest} ${min}` : `${hours} ${hr}`;
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
  /** May be fractional: a 40-second session is 0.67, shown as "<1 dk". */
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
  /** "+{count} more" for an exercise list that does not fit. */
  moreExercises?: string;
}

export const DEFAULT_SHARE_CARD_LABELS: ShareCardLabels = {
  duration: "Süre",
  volume: "Hacim",
  sets: "Set",
  untitled: "Antrenman",
  moreExercises: "+{count} egzersiz daha",
};

const ENGLISH_SHARE_CARD_LABELS: ShareCardLabels = {
  duration: "Time",
  volume: "Volume",
  sets: "Sets",
  untitled: "Workout",
  moreExercises: "+{count} more",
};

/** The card's wording for a locale; Turkish unless the locale is English. */
export const shareCardLabelsFor = (locale = "tr-TR"): ShareCardLabels =>
  isEnglish(locale) ? ENGLISH_SHARE_CARD_LABELS : DEFAULT_SHARE_CARD_LABELS;

/** The card's locale for a language code such as an i18n "en" or "tr". */
export const shareCardLocaleFor = (language: string | undefined | null): string =>
  isEnglish(language ?? "") ? "en-US" : "tr-TR";

/**
 * Builds the card's contents from a finished workout.
 *
 * Shared so the preview the app draws and the file the server rasterises are
 * built from one function: same rounding, same wording, same order. A card
 * whose numbers shift between the picker and the download would be worse than
 * no card at all.
 *
 * A missing time (no timer ran) and a volume of nothing (a bodyweight session)
 * are left off rather than printed as "0 dk" and "0 kg".
 */
export const workoutToShareCardData = (
  workout: ShareCardWorkoutLike,
  username: string,
  labels?: ShareCardLabels,
  locale = "tr-TR",
): ShareCardData => {
  const words = { ...shareCardLabelsFor(locale), ...labels };
  const duration = Number(workout.durationMinutes) || 0;
  const volume = Number(workout.volumeKg) || 0;
  const sets = Number(workout.totalSets) || 0;
  const stats: ShareCardStat[] = [];
  if (duration > 0) stats.push({ key: "duration", label: words.duration, value: formatShareDuration(duration, locale), amount: duration });
  if (volume > 0) stats.push({ key: "volume", label: words.volume, value: formatShareVolume(volume), amount: volume });
  stats.push({ key: "sets", label: words.sets, value: String(sets), amount: sets });

  return {
    title: workout.name?.trim() || words.untitled,
    username: username || "motionmeet",
    subtitle: formatShareDate(workout.startTime, locale),
    stats,
    exercises: workout.exercises.map((exercise) => ({
      sets: exercise.sets.length,
      name: exercise.exerciseName,
      equipment: exercise.equipment,
      muscleGroup: exercise.muscleGroup,
    })),
    moreExercisesLabel: words.moreExercises,
    // Every distinct muscle the session touched, so the figure shades all of
    // them rather than only whatever the first movement happened to work.
    muscles: [
      ...new Set(
        workout.exercises
          .map((exercise) => exercise.muscleGroup)
          .filter((group): group is string => Boolean(group && group.trim())),
      ),
    ],
  };
};
