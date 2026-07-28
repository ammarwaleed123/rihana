import { mkdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

/**
 * Generate the iOS home-screen launch images (apple-touch-startup-image).
 *
 * Android/Chrome build a splash from the manifest (background colour + icon +
 * name) automatically; iOS does not — without these images the installed app
 * shows a black frame while it starts. Each image is the paper background with
 * the logo and the academy name centred, matching the manifest splash so the
 * open sequence looks the same on every phone.
 *
 * Run after the logo changes: `npm run splash:generate`. Output is committed;
 * the matching <link> tags live in src/components/pwa/apple-splash.tsx and must
 * be kept in step with the DEVICES list below.
 */

const LOGO = path.join(process.cwd(), "public", "logo.png");
const OUT_DIR = path.join(process.cwd(), "public", "splash");

// #FFF9EF — the construction-paper background, matching the manifest.
const PAPER = { r: 255, g: 249, b: 239, alpha: 1 };
const INK = "#33402f";

// [cssWidth, cssHeight, devicePixelRatio], portrait. Covers the common iPhones;
// any device not listed falls back to the paper canvas colour (no black frame).
export const DEVICES: Array<[number, number, number]> = [
  [320, 568, 2],
  [375, 667, 2],
  [375, 812, 3],
  [390, 844, 3],
  [393, 852, 3],
  [402, 874, 3],
  [414, 736, 3],
  [414, 896, 2],
  [414, 896, 3],
  [428, 926, 3],
  [430, 932, 3],
  [440, 956, 3],
];

function escapeXml(value: string): string {
  return value.replace(/[<>&]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;",
  );
}

async function splash(deviceW: number, deviceH: number) {
  const short = Math.min(deviceW, deviceH);
  const logoTarget = Math.round(short * 0.34);

  const logo = await sharp(LOGO)
    .resize({ width: logoTarget, height: logoTarget, fit: "inside" })
    .png()
    .toBuffer();
  const meta = await sharp(logo).metadata();
  const lw = meta.width ?? logoTarget;
  const lh = meta.height ?? logoTarget;

  const logoLeft = Math.round((deviceW - lw) / 2);
  const logoTop = Math.round(deviceH * 0.4 - lh / 2);

  const fontSize = Math.round(short * 0.05);
  const textY = logoTop + lh + Math.round(fontSize * 2.2);
  const text = escapeXml("Rihana Montessori Academy");
  const svg = `<svg width="${deviceW}" height="${deviceH}" xmlns="http://www.w3.org/2000/svg"><text x="${deviceW / 2}" y="${textY}" text-anchor="middle" font-family="'Segoe UI', Helvetica, Arial, sans-serif" font-weight="700" font-size="${fontSize}" letter-spacing="0.3" fill="${INK}">${text}</text></svg>`;

  const file = `splash-${deviceW}x${deviceH}.png`;
  await sharp({
    create: { width: deviceW, height: deviceH, channels: 4, background: PAPER },
  })
    .composite([
      { input: logo, left: logoLeft, top: logoTop },
      { input: Buffer.from(svg), top: 0, left: 0 },
    ])
    .png()
    .toFile(path.join(OUT_DIR, file));

  console.log(`  ${file}  ${deviceW}×${deviceH}`);
}

await mkdir(OUT_DIR, { recursive: true });
console.log("[splash] generating iOS launch images from public/logo.png…");
for (const [cssW, cssH, ratio] of DEVICES) {
  await splash(cssW * ratio, cssH * ratio);
}
console.log("[splash] done.");
