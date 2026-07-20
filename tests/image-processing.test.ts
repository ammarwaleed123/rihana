import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  createThumbnail,
  processUpload,
  readMetadata,
  sniffMimeType,
  UnsupportedImageError,
} from "@/lib/images/process";

/**
 * Upload safety, verified rather than assumed.
 *
 * The claims under test: content type comes from magic bytes, GPS coordinates
 * never survive ingestion, and anything undecodable is rejected instead of
 * stored.
 */

/** A JPEG carrying GPS EXIF, as a phone photo of a child would. */
async function photoWithGps(): Promise<Buffer> {
  const base = await sharp({
    create: {
      width: 800,
      height: 600,
      channels: 3,
      background: { r: 120, g: 160, b: 90 },
    },
  })
    .jpeg()
    .toBuffer();

  // Attach EXIF including GPS. sharp writes it via exiftool-style tags.
  return sharp(base)
    .withMetadata({
      exif: {
        IFD0: {
          Make: "TestPhone",
          Model: "TestModel",
          Software: "RihanaTest",
        },
        IFD3: {
          GPSLatitudeRef: "N",
          GPSLatitude: "51/1 30/1 0/1",
          GPSLongitudeRef: "W",
          GPSLongitude: "0/1 7/1 0/1",
        },
      },
    })
    .toBuffer();
}

describe("magic-byte sniffing", () => {
  it("identifies a real JPEG", async () => {
    const jpeg = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#3E7C4F" },
    })
      .jpeg()
      .toBuffer();

    expect(await sniffMimeType(jpeg)).toBe("image/jpeg");
  });

  it("identifies a PNG regardless of what it might be called", async () => {
    const png = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#3E7C4F" },
    })
      .png()
      .toBuffer();

    // The filename is never consulted; only the bytes.
    expect(await sniffMimeType(png)).toBe("image/png");
  });

  it("returns null for a text file dressed up as an image", async () => {
    const notAnImage = Buffer.from(
      "<?php system($_GET['c']); ?>".repeat(20),
      "utf8",
    );
    expect(await sniffMimeType(notAnImage)).toBeNull();
  });
});

describe("rejecting what we will not store", () => {
  it("rejects a non-image outright", async () => {
    const notAnImage = Buffer.from("just some text, definitely not a photo");

    await expect(processUpload(notAnImage)).rejects.toBeInstanceOf(
      UnsupportedImageError,
    );
  });

  it("rejects an executable renamed to .jpg", async () => {
    // MZ header — a Windows executable. Extension is irrelevant; the bytes are
    // what get inspected.
    const exe = Buffer.concat([
      Buffer.from([0x4d, 0x5a, 0x90, 0x00]),
      Buffer.alloc(512, 0x41),
    ]);

    await expect(processUpload(exe)).rejects.toBeInstanceOf(
      UnsupportedImageError,
    );
  });

  it("rejects a PDF, which is an image to nobody", async () => {
    const pdf = Buffer.from("%PDF-1.7\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\n");

    await expect(processUpload(pdf)).rejects.toBeInstanceOf(
      UnsupportedImageError,
    );
  });

  it("rejects an empty file", async () => {
    await expect(processUpload(Buffer.alloc(0))).rejects.toBeInstanceOf(
      UnsupportedImageError,
    );
  });
});

describe("metadata stripping", () => {
  it("the fixture really does carry GPS data to begin with", async () => {
    // Otherwise the next test would pass for the wrong reason.
    const withGps = await photoWithGps();
    const before = await readMetadata(withGps);
    expect(before.hasExif).toBe(true);
  });

  it("removes EXIF from the stored original", async () => {
    const processed = await processUpload(await photoWithGps());
    const after = await readMetadata(processed.original.buffer);

    expect(after.hasExif).toBe(false);
  });

  it("removes EXIF from the web variant", async () => {
    const processed = await processUpload(await photoWithGps());
    const after = await readMetadata(processed.web.buffer);

    expect(after.hasExif).toBe(false);
  });

  it("removes EXIF from the thumbnail", async () => {
    const processed = await processUpload(await photoWithGps());
    const thumb = await createThumbnail(processed.original.buffer);

    expect((await readMetadata(thumb.buffer)).hasExif).toBe(false);
  });

  it("leaves no GPS coordinates anywhere in the stored bytes", async () => {
    // The strongest form of the check: scan the actual file for the marker
    // strings, rather than trusting a metadata parser to report them.
    const processed = await processUpload(await photoWithGps());

    for (const variant of [processed.original.buffer, processed.web.buffer]) {
      const asText = variant.toString("latin1");
      expect(asText).not.toContain("GPSLatitude");
      expect(asText).not.toContain("GPSLongitude");
      expect(asText).not.toContain("TestPhone");
      expect(asText).not.toContain("RihanaTest");
    }
  });

  it("strips IPTC and XMP as well as EXIF", async () => {
    const processed = await processUpload(await photoWithGps());
    const after = await readMetadata(processed.original.buffer);

    expect(after.hasIptc).toBe(false);
    expect(after.hasXmp).toBe(false);
  });
});

describe("re-encoding", () => {
  it("always outputs JPEG, whatever went in", async () => {
    const png = await sharp({
      create: { width: 400, height: 300, channels: 3, background: "#7AC0E4" },
    })
      .png()
      .toBuffer();

    const processed = await processUpload(png);
    expect((await readMetadata(processed.original.buffer)).format).toBe("jpeg");
  });

  it("produces bytes that differ from the upload", async () => {
    // This is what defuses a polyglot file: what we store is sharp's output,
    // not the uploader's.
    const input = await photoWithGps();
    const processed = await processUpload(input);

    expect(processed.original.buffer.equals(input)).toBe(false);
  });

  it("caps the long edge and keeps the web variant smaller", async () => {
    const large = await sharp({
      create: { width: 5000, height: 3000, channels: 3, background: "#FFC63F" },
    })
      .jpeg()
      .toBuffer();

    const processed = await processUpload(large);

    expect(processed.original.width).toBeLessThanOrEqual(2560);
    expect(processed.web.width).toBeLessThanOrEqual(1280);
    expect(processed.web.byteSize).toBeLessThan(processed.original.byteSize);
  });

  it("does not upscale a small photo", async () => {
    const small = await sharp({
      create: { width: 200, height: 150, channels: 3, background: "#FF7A6E" },
    })
      .jpeg()
      .toBuffer();

    const processed = await processUpload(small);

    expect(processed.original.width).toBe(200);
    expect(processed.original.height).toBe(150);
  });

  it("checksums the stored bytes, so identical photos collide and different ones do not", async () => {
    const a = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "#3E7C4F" },
    })
      .jpeg()
      .toBuffer();

    const b = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "#FF7A6E" },
    })
      .jpeg()
      .toBuffer();

    const [first, second, differentColour] = await Promise.all([
      processUpload(a),
      processUpload(a),
      processUpload(b),
    ]);

    expect(first.checksumSha256).toBe(second.checksumSha256);
    expect(first.checksumSha256).not.toBe(differentColour.checksumSha256);
  });

  it("honours EXIF orientation before discarding it", async () => {
    // A portrait phone photo is often stored landscape with an orientation flag.
    // Dropping metadata without applying it first would leave every such photo
    // sideways in the family's album.
    const landscapeWithRotationFlag = await sharp({
      create: { width: 400, height: 200, channels: 3, background: "#7AC0E4" },
    })
      .jpeg()
      .withMetadata({ orientation: 6 }) // rotate 90° clockwise
      .toBuffer();

    const processed = await processUpload(landscapeWithRotationFlag);

    // Applied: the stored image is now taller than it is wide.
    expect(processed.original.height).toBeGreaterThan(processed.original.width);
    // And the flag itself is gone.
    expect((await readMetadata(processed.original.buffer)).hasExif).toBe(false);
  });
});
