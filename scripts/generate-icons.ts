import { mkdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

/**
 * Generate the PWA / home-screen icon set from the brand logo.
 *
 * Run after the logo changes: `npm run icons:generate`. Output goes to
 * public/icons and is committed — icons are build assets, not generated at
 * request time.
 *
 * Two families are produced:
 *   - "any": the logo on the paper background with a little breathing room, for
 *     browsers that render the icon as-is.
 *   - "maskable": the logo pulled well inside the safe zone so Android can crop
 *     it to a circle/squircle without clipping the wordmark, with the paper
 *     background filling the whole tile.
 *
 * iOS dislikes transparency on the home screen, so every tile is flattened onto
 * the solid paper colour rather than left transparent.
 */

const LOGO = path.join(process.cwd(), "public", "logo.png");
const OUT_DIR = path.join(process.cwd(), "public", "icons");

// #FFF9EF — the construction-paper background, matching the manifest theme.
const PAPER = { r: 255, g: 249, b: 239, alpha: 1 };

async function tile(size: number, filename: string, contentRatio: number) {
  const inner = Math.round(size * contentRatio);

  const logo = await sharp(LOGO)
    .resize({ width: inner, height: inner, fit: "inside" })
    .png()
    .toBuffer();
  const meta = await sharp(logo).metadata();

  const left = Math.round((size - (meta.width ?? inner)) / 2);
  const top = Math.round((size - (meta.height ?? inner)) / 2);

  await sharp({
    create: { width: size, height: size, channels: 4, background: PAPER },
  })
    .composite([{ input: logo, left, top }])
    .png()
    .toFile(path.join(OUT_DIR, filename));

  console.log(`  ${filename}  ${size}×${size}`);
}

await mkdir(OUT_DIR, { recursive: true });
console.log("[icons] generating from public/logo.png…");
await tile(192, "icon-192.png", 0.8);
await tile(512, "icon-512.png", 0.8);
await tile(192, "icon-maskable-192.png", 0.6);
await tile(512, "icon-maskable-512.png", 0.6);
await tile(180, "apple-touch-icon.png", 0.82);
console.log("[icons] done.");
