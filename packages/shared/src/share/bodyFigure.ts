/**
 * The anatomy figure: a front and a back view of one athletic body, with the
 * muscle groups drawn as separate plates over a quiet silhouette.
 *
 * It answers one question at a glance - what did this session work - so a
 * worked group is a solid block of colour against a body that is barely there.
 * Both views are needed for that: a back day drawn on a front-only figure lit
 * nothing but the shoulders.
 *
 * Everything is authored on a 100 x 218 grid per view, with the spine on
 * x = 50, and only the viewer's left half is written out. The right half is
 * the same paths mirrored about the spine, so the two sides cannot drift.
 * Plain paths and fills only - no filters, blurs or gradients - so the same
 * markup renders identically in react-native-svg, browsers and librsvg.
 */

/** Every plate the figure can light, front and back. */
export const MUSCLE_REGIONS = [
  "chest",
  "frontDelts",
  "rearDelts",
  "biceps",
  "triceps",
  "forearms",
  "abs",
  "obliques",
  "traps",
  "lats",
  "lowerBack",
  "glutes",
  "quads",
  "hamstrings",
  "adductors",
  "calves",
] as const;
export type MuscleRegion = (typeof MUSCLE_REGIONS)[number];

/**
 * What each muscle code lights.
 *
 * Codes arrive at three levels of detail: the app's catalogue groups ("arms"),
 * the exercise dataset's body parts ("upper arms") and a movement's own target
 * ("triceps"). A group lights every plate it covers and nothing finer is
 * inferred from it: "arms" lights biceps and triceps both, because the data
 * does not say which one an arm day was.
 */
const REGIONS_BY_CODE: Record<string, readonly MuscleRegion[]> = {
  chest: ["chest"], pectorals: ["chest"],
  back: ["lats", "traps", "lowerBack"],
  lats: ["lats"], "upper back": ["traps", "lats"], traps: ["traps"],
  "lower back": ["lowerBack"], spine: ["lowerBack"],
  shoulders: ["frontDelts", "rearDelts"], delts: ["frontDelts", "rearDelts"],
  "front delts": ["frontDelts"], "rear delts": ["rearDelts"],
  neck: ["traps"], "levator scapulae": ["traps"],
  arms: ["biceps", "triceps", "forearms"], "upper arms": ["biceps", "triceps"],
  biceps: ["biceps"], triceps: ["triceps"],
  "lower arms": ["forearms"], forearms: ["forearms"],
  abs: ["abs", "obliques"], waist: ["abs", "obliques"], core: ["abs", "obliques"],
  obliques: ["obliques"], "serratus anterior": ["obliques"],
  legs: ["quads", "hamstrings", "glutes", "adductors", "calves"],
  "upper legs": ["quads", "hamstrings", "glutes", "adductors"],
  "lower legs": ["calves"], calves: ["calves"],
  quads: ["quads"], hamstrings: ["hamstrings"], glutes: ["glutes"],
  adductors: ["adductors"], abductors: ["glutes"],
  "full body": [...MUSCLE_REGIONS],
};

const normaliseCode = (code: string): string =>
  code.trim().toLowerCase().replace(/[_\-\s]+/g, " ");

/** The plates a list of muscle codes lights. Unknown codes light nothing. */
export const regionsForMuscles = (codes: readonly string[]): Set<MuscleRegion> => {
  const regions = new Set<MuscleRegion>();
  for (const code of codes) {
    for (const region of REGIONS_BY_CODE[normaliseCode(code)] ?? []) regions.add(region);
  }
  return regions;
};

/** Whether a code is one the figure knows how to draw. */
export const isKnownMuscleCode = (code: string): boolean =>
  Object.prototype.hasOwnProperty.call(REGIONS_BY_CODE, normaliseCode(code));

/** One view's grid, and the gap between the two views. */
const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 218;
const VIEW_GAP = 12;
/** The drawn body spans x 6..94 of its grid; the margins are trimmed. */
const BODY_INSET = 6;
const VIEW_BODY_WIDTH = VIEW_WIDTH - BODY_INSET * 2;

/** Width over height of the figure, for callers that place it by its edges. */
export const BODY_FIGURE_ASPECT = {
  both: (VIEW_BODY_WIDTH * 2 + VIEW_GAP) / VIEW_HEIGHT,
  front: VIEW_BODY_WIDTH / VIEW_HEIGHT,
} as const;

/** The silhouette, shared by both views: the head is whole, the rest is a half. */
const HEAD = "M50 2c6.4 0 10.6 5 10.6 12.2 0 7.6-4.4 13.6-10.6 13.6S39.4 21.8 39.4 14.2C39.4 7 43.6 2 50 2z";
/** Covers the seam where the two mirrored halves meet down the middle. */
const SPINE = "M45 26h10v88H45z";
const SILHOUETTE_HALF = [
  // neck, trapezius slope, deltoid, flank, waist, hip
  "M50 25l-5.6.6c.2 3.4-.6 5.6-2.6 7.2-5 1.8-10.4 2.8-15.6 4C19.6 38.4 15.6 43 14.6 49.6L14 60c2.6 2.6 6.4 3.4 9.8 3.2.6 9 1.8 18.4 4.4 28.2 1.2 5 1.4 10.2.8 16.4-.4 4.4 1.8 8 5 10.6L50 121z",
  // upper arm
  "M15.4 45c-4.4 5.6-5.8 14.4-5.8 25.4 0 7.4.8 13.4 3 18.6h9.6c2-7 2.2-15.4 1.4-24-.6-7-1.8-13.4-3.6-19z",
  // forearm and hand
  "M12.6 87.6C9.6 95.6 7.6 105 7.4 115.4c0 3.4.4 6.4 1.4 9.2-1.8 3.6-2.2 8-.8 11.6 1.8 2.6 5.2 2.6 6.8-.4l1.4-11.2c2-6.6 3.8-14.4 5.4-23 .8-4.6.8-9 .4-14z",
  // thigh
  "M29.8 107.4c-3.2 10.6-4.6 24.6-3.6 38.6.6 7.2 2.2 12.4 4.4 16.4H44c1.2-9.4 3-21.6 5-33.6l1-8.8v-12z",
  // lower leg and foot
  "M30.6 160.6c-2.8 8.4-3.2 19.6-.8 31.6 1 5 2.2 9.2 3 12.8-2 3.2-2.6 6.4-1.2 9 3.6.8 8 .8 11.2 0 .8-2.6.2-5.6-1.4-8.4 1.4-8.6 2.6-17.6 2.8-26.4.2-7 .2-13-.6-18.6z",
];

/** The plates on the front view, viewer's left half. */
const FRONT_PLATES: ReadonlyArray<{ region: MuscleRegion; d: string }> = [
  { region: "frontDelts", d: "M26.4 37.6c-6.2 1.2-10.4 5.6-11.4 12-.4 4 .6 7.6 2.6 10.2 1.6-6.4 5.4-11.6 11.6-14.8 1-3 .2-5.6-2.8-7.4z" },
  { region: "chest", d: "M48.6 40.8c-6.6-1.4-13.4-.4-17.8 3.6-3 3-4.4 8.2-3.4 13.2.6 2.8 2.2 4.6 4.6 5.6 5.6 2 11.6 2 16.6-.6z" },
  { region: "biceps", d: "M16.8 61.6c-2.6 5-3.4 12-2.4 19.6.6 3.8 3 5.8 5.6 5 2-.8 2.6-3.8 2.6-7.4 0-6-.8-12-2.4-16.2-1.2-1.6-2.4-1.8-3.4-1z" },
  { region: "forearms", d: "M12.8 91.6c-2.2 6.6-3.2 14-3.2 22.4l4.4 1c2-6.4 3.8-13.6 5.2-21.2.4-2.2-.6-3.6-2.6-3.8z" },
  { region: "obliques", d: "M29.6 66.4c.2 10 1.4 20.4 4.2 30.2 1.4 4.4 3.6 7 6.4 8.4-.8-11.4-.8-24.6.4-36.4-3.8-.2-7.6-1-11-2.2z" },
  { region: "abs", d: "M42.4 68.6c0-1 .8-1.8 1.8-1.8h4.4v8.6h-6.2zM42.4 77.2h6.2v8.4h-6.2zM42.6 87.4h6v8.6h-6zM43 97.8h5.6v10.8c-2.4-.4-4.6-3.4-5.6-6.6z" },
  { region: "quads", d: "M31.2 113.4c-3 9.6-4 21.6-3 33 .6 5.8 2.6 9.6 5.6 10.6 4-.6 7-4.6 8.2-10.8 1.6-9.4 1.8-20.4.6-30.2-3.6-2.4-7.8-3.4-11.4-2.6z" },
  { region: "adductors", d: "M44.2 119.6c.8 8 .8 16.6.2 24 2.2-5.4 4-13.2 5-21.4l-.2-2.6z" },
  { region: "calves", d: "M31.8 166.4c-1.8 7.4-1.6 16.2.4 25.2l3.8.8c1.8-8.6 2.4-17.6 1.6-26.4zM39.6 165.6c1 6.8.8 14.2-.2 21.4 2-1.6 3.4-5.6 3.8-10.6.2-4-.2-7.6-1.2-10.8z" },
];

/** The plates on the back view, viewer's left half. */
const BACK_PLATES: ReadonlyArray<{ region: MuscleRegion; d: string }> = [
  { region: "traps", d: "M48.6 25.6l-3.6.4c-.2 3.2-1.2 5.6-3.4 7.2-4.2 1.6-8.6 2.8-13.2 3.8 6 2.6 11 6.8 14.2 12.6 2.4 4.4 4.4 9.4 6 14.8z" },
  { region: "rearDelts", d: "M26.4 37.6c-6.2 1.2-10.4 5.6-11.4 12-.4 4 .6 7.6 2.6 10.2 2-6 6-11.2 11.8-14.6z" },
  { region: "triceps", d: "M16.6 61c-2.6 5.4-3.4 12.4-2.2 20 .6 3.4 2.8 5.4 5.4 4.8 2.2-.6 3-3.6 3-7.4-.2-6.2-1.2-12.2-3-16.6-1-1.4-2.2-1.6-3.2-.8z" },
  { region: "forearms", d: "M12.8 91.6c-2.2 6.6-3.2 14-3.2 22.4l4.4 1c2-6.4 3.8-13.6 5.2-21.2.4-2.2-.6-3.6-2.6-3.8z" },
  { region: "lats", d: "M29.4 49.4c-3 6.4-3.4 15.4-1 25.4 2 8.2 5.8 15.4 11.6 20.6 3.6-4.6 6.4-10.2 8.6-16.6V69.6c-5-8.6-11.2-15.6-19.2-20.2z" },
  { region: "lowerBack", d: "M48.6 84.4c-2.2 4.2-4.6 8-7.4 11 .6 4.6 2.4 9 5 12.2l2.4.6z" },
  { region: "glutes", d: "M48.6 109.4c-6.4-2.6-13.4-2.2-17.2 2-2.4 5-2 11.4 1.6 16 4 3.6 10.2 4.2 15.6 1.6z" },
  { region: "hamstrings", d: "M30.8 132.4c-1.8 7.4-2 15.6-.4 22.8 1.4 2.8 4 3.6 6.4 2.4 2.6-6.6 4.4-15 5.2-23.4-3.8.2-7.6-.4-11.2-1.8zM44 134.4c.4 7.8.2 15.4-.8 21.8 2.6-5.4 4.4-12.8 5.2-21.2z" },
  { region: "calves", d: "M31.2 161.8c-2.8 5.8-3.2 13.4-1.2 21.4 1.2 3.6 3.8 4.6 6.4 3.4 1.4-7.4 1.4-15.8-.2-23.6-1.8-1.4-3.6-1.8-5-1.2zM39.2 162.4c1.4 7.6 1.6 15.8.6 23.6 2.4-.2 4-2.4 4.4-6.4.4-6.2.2-12-1.4-16.4-1-1.2-2.4-1.4-3.6-.8z" },
];

const NEWLINE = String.fromCharCode(10);

export interface BodyFigureColors {
  /** Fill of a lit plate. */
  worked: string;
  /** Fill of the body and of unlit plates; their opacities are set below. */
  ink: string;
  bodyOpacity: number;
  idleOpacity: number;
}

export const DEFAULT_BODY_FIGURE_COLORS: BodyFigureColors = {
  worked: "#22D3EE",
  ink: "#FFFFFF",
  bodyOpacity: 0.09,
  idleOpacity: 0.16,
};

const mirror = (markup: string): string =>
  `<g transform="translate(${VIEW_WIDTH} 0) scale(-1 1)">${NEWLINE}${markup}${NEWLINE}</g>`;

const drawView = (
  plates: ReadonlyArray<{ region: MuscleRegion; d: string }>,
  lit: Set<MuscleRegion>,
  colors: BodyFigureColors,
): string => {
  const half = SILHOUETTE_HALF.map((d) => `<path d="${d}"/>`).join(NEWLINE);
  // One opacity for the whole silhouette: per-path transparency turned every
  // place two limbs overlap into a darker seam.
  const silhouette = `<g fill="${colors.ink}" opacity="${colors.bodyOpacity}">${NEWLINE}<path d="${HEAD}"/>${NEWLINE}<path d="${SPINE}"/>${NEWLINE}${half}${NEWLINE}${mirror(half)}${NEWLINE}</g>`;
  const idle = plates.filter((plate) => !lit.has(plate.region)).map((plate) => `<path d="${plate.d}"/>`).join(NEWLINE);
  const worked = plates.filter((plate) => lit.has(plate.region)).map((plate) => `<path d="${plate.d}"/>`).join(NEWLINE);
  return [
    silhouette,
    idle ? `<g fill="${colors.ink}" opacity="${colors.idleOpacity}">${NEWLINE}${idle}${NEWLINE}${mirror(idle)}${NEWLINE}</g>` : "",
    worked ? `<g fill="${colors.worked}">${NEWLINE}${worked}${NEWLINE}${mirror(worked)}${NEWLINE}</g>` : "",
  ].filter(Boolean).join(NEWLINE);
};

export interface BodyFigureOptions {
  /** Top-left corner of the figure's drawn area, and its height. */
  x: number;
  y: number;
  height: number;
  views?: "both" | "front";
  colors?: BodyFigureColors;
}

/**
 * The figure as an SVG fragment (no `<svg>` wrapper), lighting every plate the
 * given muscle codes cover.
 */
export const bodyFigureSvg = (muscles: readonly string[], options: BodyFigureOptions): string => {
  const { x, y, height, views = "both", colors = DEFAULT_BODY_FIGURE_COLORS } = options;
  const lit = regionsForMuscles(muscles);
  const scale = height / VIEW_HEIGHT;
  const front = drawView(FRONT_PLATES, lit, colors);
  const origin = `translate(${x - BODY_INSET * scale} ${y}) scale(${scale})`;
  if (views === "front") return `<g transform="${origin}">${NEWLINE}${front}${NEWLINE}</g>`;
  const back = drawView(BACK_PLATES, lit, colors);
  const backOffset = VIEW_BODY_WIDTH + VIEW_GAP;
  return `<g transform="${origin}">
${front}
<g transform="translate(${backOffset} 0)">
${back}
</g>
</g>`;
};

/** A standalone SVG document of the figure, for icons and previews. */
export const bodyFigureDocument = (
  muscles: readonly string[],
  views: "both" | "front" = "both",
  colors: BodyFigureColors = DEFAULT_BODY_FIGURE_COLORS,
): string => {
  const height = VIEW_HEIGHT;
  const width = Math.ceil(height * BODY_FIGURE_ASPECT[views]);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${bodyFigureSvg(muscles, { x: 0, y: 0, height, views, colors })}</svg>`;
};
