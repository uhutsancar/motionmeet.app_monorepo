import sharp from "sharp";
import {
  SHARE_CARD_SIZES,
  SHARE_CARD_TEMPLATES,
  buildShareCardSvg,
  workoutToShareCardData,
  type ShareCardData,
  type ShareCardSize,
  type ShareCardTemplate,
} from "@motionmeet/shared";
import { database } from "../configs/database.js";
import { findWorkoutById } from "../repositories/workoutRepository.js";
import { findHydratedPost } from "../repositories/postRepository.js";
import { canAccessPost } from "./accessControlService.js";

/**
 * Turns a workout into the picture people post about it.
 *
 * The layout is not decided here — `@motionmeet/shared` draws the card, and the
 * app draws the very same SVG for its picker. This module's whole job is to
 * gather the numbers from the database and hand the result to a rasteriser, so
 * what somebody saves to their camera roll is the card they were looking at
 * when they tapped, down to the pixel.
 *
 * Rasterising on the server rather than in the app is deliberate. Capturing a
 * view on the device needs a native module that Expo Go does not carry, and
 * turning a 4000px photo into a PNG on a mid-range phone locks the interface
 * for seconds. Here it costs one request and the phone stays responsive.
 */

export const isShareCardTemplate = (value: unknown): value is ShareCardTemplate =>
  typeof value === "string" && (SHARE_CARD_TEMPLATES as readonly string[]).includes(value);

export const isShareCardSize = (value: unknown): value is ShareCardSize =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(SHARE_CARD_SIZES, value);

/**
 * Collects everything a card can show for one workout.
 *
 * Returns null when the workout is missing or belongs to someone else: a share
 * card is a picture of your own session, and nobody may render one of another
 * member's training by guessing an id.
 */
export const buildWorkoutShareCardData = async (
  workoutId: string,
  userId: string,
): Promise<ShareCardData | null> => {
  const workout = await findWorkoutById(workoutId);
  if (!workout || workout.userId !== userId) return null;

  const user = await database
    .selectFrom("users")
    .select(["username", "full_name"])
    .where("id", "=", userId)
    .executeTakeFirst();

  return workoutToShareCardData(workout, user?.username || user?.full_name || "motionmeet");
};

/**
 * Rasterises a card.
 *
 * PNG rather than JPEG: these are flat colour and crisp type, which is exactly
 * what PNG is good at and what JPEG turns to mush around the edges of letters.
 */
export const renderShareCardPng = async (
  data: ShareCardData,
  template: ShareCardTemplate,
  size: ShareCardSize,
): Promise<Buffer> => {
  const svg = buildShareCardSvg(data, template, size);
  return sharp(Buffer.from(svg), { density: 96 })
    .png({ compressionLevel: 9 })
    .toBuffer();
};

/** Beyond this a picture is a download, not a share card ingredient. */
const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
const PHOTO_FETCH_TIMEOUT_MS = 8000;

/**
 * The Strava arrangement: the member's own photo, with the numbers on it.
 *
 * The picture stays the subject — it is resized to the card's shape and the
 * information layer is composited over a gradient scrim, rather than the photo
 * being shrunk into a panel on a branded background. Nothing is invented: only
 * the stats the post actually carries are drawn, so a photo post with no
 * workout attached gets the caption and the mark and nothing else.
 */
export const renderPostShareCardPng = async (
  postId: string,
  viewerId: string,
  template: ShareCardTemplate,
  size: ShareCardSize,
): Promise<Buffer | null> => {
  const post = await findHydratedPost(postId);
  if (!post) return null;

  const author = typeof post.user === "object" ? post.user : null;
  if (!author) return null;
  if (!(await canAccessPost({ user: author.id, visibility: post.visibility }, viewerId))) return null;

  const photoUrl = post.media?.find((entry) => entry.mediaType === "image")?.url ?? post.image_urls?.[0];

  const workout = typeof post.workout === "object" && post.workout ? post.workout : null;
  const data: ShareCardData = workout
    ? { ...workoutToShareCardData(workout, author.username), overPhoto: Boolean(photoUrl) }
    : {
        title: post.content?.trim().split("\n")[0]?.slice(0, 40) || "MotionMeet",
        username: author.username || "motionmeet",
        stats: [],
        exercises: [],
        overPhoto: Boolean(photoUrl),
      };

  const svg = Buffer.from(buildShareCardSvg(data, template, size));
  const { width, height } = SHARE_CARD_SIZES[size];

  if (!photoUrl) return renderShareCardPng(data, template, size);

  const photo = await fetchPhoto(photoUrl);
  if (!photo) return renderShareCardPng({ ...data, overPhoto: false }, template, size);

  // Cover, not contain: the card is a fixed shape and a letterboxed photo with
  // bars down the side is not something anybody posts.
  return sharp(photo)
    .resize(width, height, { fit: "cover", position: "attention" })
    .composite([{ input: svg, top: 0, left: 0 }])
    .png({ compressionLevel: 9 })
    .toBuffer();
};

/**
 * Pulls the post's photo down so it can be composited.
 *
 * Bounded on both time and size: this runs inside a request, and the URL points
 * at a CDN that could be slow or, in a misconfiguration, at something very
 * large. A failure is not an error — the card falls back to the brand plate.
 */
const fetchPhoto = async (url: string): Promise<Buffer | null> => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(PHOTO_FETCH_TIMEOUT_MS) });
    if (!response.ok) return null;
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_PHOTO_BYTES) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.byteLength > MAX_PHOTO_BYTES ? null : buffer;
  } catch {
    return null;
  }
};
