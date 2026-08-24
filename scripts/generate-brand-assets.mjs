/**
 * Renders every raster the apps ship from the two canonical vectors in `brand/`,
 * so the icon in the Android launcher, the iOS home screen, the browser tab and
 * the in-app header can never drift apart. Run it after editing either SVG:
 *
 *   node scripts/generate-brand-assets.mjs
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mark = await readFile(join(root, "brand/motionmeet-mark.svg"));
const glyph = await readFile(join(root, "brand/motionmeet-glyph.svg"));

/** The near-black the tile gradient sits in, used wherever the glyph needs a plate. */
const BRAND_BACKGROUND = "#0B1220";

const write = async (relativePath, buffer) => {
  const target = join(root, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, buffer);
  console.log(`  ${relativePath} (${(buffer.length / 1024).toFixed(1)} kB)`);
};

/** The full tile, used wherever the platform does not mask the icon itself. */
const tile = (size) => sharp(mark).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

/**
 * Android masks adaptive icons to an arbitrary shape and only the middle 66%
 * is guaranteed visible, so the foreground is the bare glyph scaled into that
 * safe zone rather than the tile, which would lose its corners.
 */
const adaptiveForeground = async (size) => {
  const safe = Math.round(size * 0.62);
  const inner = await sharp(glyph).resize(safe, safe).png().toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: inner, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
};

/** Splash screens letterbox the image, so it gets its own brand-coloured plate. */
const splash = async (size) => {
  const inner = await sharp(glyph).resize(Math.round(size * 0.5), Math.round(size * 0.5)).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: BRAND_BACKGROUND } })
    .composite([{ input: inner, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
};

console.log("mobile");
await write("packages/mobile/assets/icon.png", await tile(1024));
await write("packages/mobile/assets/adaptive-icon.png", await adaptiveForeground(1024));
await write("packages/mobile/assets/splash-icon.png", await splash(1024));
await write("packages/mobile/assets/favicon.png", await tile(64));

console.log("web");
await write("packages/web/public/favicon.svg", mark);
await write("packages/web/public/favicon-32.png", await tile(32));
await write("packages/web/public/favicon-192.png", await tile(192));
await write("packages/web/public/favicon-512.png", await tile(512));
// iOS home-screen icons are composited onto white when they carry alpha, so the
// tile is flattened onto the brand colour instead of shipping transparency.
await write(
  "packages/web/public/apple-touch-icon.png",
  await sharp(await tile(180)).flatten({ background: BRAND_BACKGROUND }).png({ compressionLevel: 9 }).toBuffer(),
);
await write("packages/web/src/assets/motionmeet_logo.svg", mark);

console.log("done");
