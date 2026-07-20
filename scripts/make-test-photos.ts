/**
 * Generate photos for manual testing, written to ./test-photos/.
 *
 * Includes a JPEG carrying real GPS EXIF, so the metadata-stripping claim can be
 * checked by hand — upload it, then run scripts/verify-photo-privacy.ts and see
 * that nothing survived.
 *
 *   npx tsx scripts/make-test-photos.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import sharp from "sharp";

const out = join(process.cwd(), "test-photos");
mkdirSync(out, { recursive: true });

const written: string[] = [];

function save(name: string, buffer: Buffer, note: string) {
  writeFileSync(join(out, name), buffer);
  written.push(`  ${name.padEnd(28)} ${note}`);
}

async function plain(width: number, height: number, colour: string) {
  return sharp({
    create: { width, height, channels: 3, background: colour },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}

// --- Ordinary photos --------------------------------------------------------
save("garden-play.jpg", await plain(1600, 1200, "#3E7C4F"), "ordinary photo");
save("painting.jpg", await plain(1400, 1050, "#FFC63F"), "ordinary photo");
save("story-time.jpg", await plain(1500, 1125, "#7AC0E4"), "ordinary photo");
save("snack-time.jpg", await plain(1300, 975, "#FF7A6E"), "ordinary photo");

// --- Carries GPS, as a phone photo of a child would -------------------------
const base = await plain(1600, 1200, "#5C6B57");
const withGps = await sharp(base)
  .withMetadata({
    exif: {
      IFD0: {
        Make: "TestPhone",
        Model: "PrivacyCheck-1",
        Software: "RihanaManualTest",
        Artist: "Should Not Survive",
      },
      IFD3: {
        // Somewhere in London — if this survives upload, that is a bug.
        GPSLatitudeRef: "N",
        GPSLatitude: "51/1 30/1 26/1",
        GPSLongitudeRef: "W",
        GPSLongitude: "0/1 7/1 39/1",
      },
    },
  })
  .toBuffer();
save("HAS-GPS-DATA.jpg", withGps, "carries GPS + camera EXIF");

// --- Portrait with an orientation flag --------------------------------------
const sideways = await sharp(await plain(1600, 900, "#E3F0E6"))
  .withMetadata({ orientation: 6 })
  .toBuffer();
save("SIDEWAYS-orientation.jpg", sideways, "should arrive upright, not rotated");

// --- Not an image, despite the name -----------------------------------------
writeFileSync(
  join(out, "NOT-AN-IMAGE.jpg"),
  "This is plain text with a .jpg name. It must be rejected.",
);
written.push(`  NOT-AN-IMAGE.jpg             text file named .jpg — must be rejected`);

// --- Too large --------------------------------------------------------------
// Noise compresses badly, so this exceeds the 15 MB cap.
const noise = Buffer.alloc(6000 * 4000 * 3);
for (let i = 0; i < noise.length; i += 1) noise[i] = Math.floor(Math.random() * 256);
const huge = await sharp(noise, {
  raw: { width: 6000, height: 4000, channels: 3 },
})
  .jpeg({ quality: 100 })
  .toBuffer();
save(
  "TOO-BIG.jpg",
  huge,
  `${(huge.byteLength / 1024 / 1024).toFixed(1)} MB — over the 15 MB cap`,
);

console.log(`\nWrote ${written.length} files to ${out}\n`);
console.log(written.join("\n"));
console.log("\nUpload HAS-GPS-DATA.jpg, then run:\n");
console.log("  npx tsx scripts/verify-photo-privacy.ts\n");
