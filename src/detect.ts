import type { ByteStream } from "./byte-stream";

/**
 * @module detect
 * Auto-detect image format from magic bytes.
 */

export type ImageFormat = "jpeg" | "png" | "heic" | "unknown";

export function detectFormat(stream: ByteStream): ImageFormat {
  if (stream.size() < 12) {
    return "unknown";
  }

  const s = stream.branch(0);

  // JPEG: 0xFF 0xD8
  const b0 = s.u8();
  const b1 = s.u8();
  if (b0 === 0xff && b1 === 0xd8) {
    return "jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  s.seek(0);
  if (
    s.u8() === 0x89 &&
    s.u8() === 0x50 &&
    s.u8() === 0x4e &&
    s.u8() === 0x47 &&
    s.u8() === 0x0d &&
    s.u8() === 0x0a &&
    s.u8() === 0x1a &&
    s.u8() === 0x0a
  ) {
    return "png";
  }

  // HEIC/HEIF/AVIF: ftyp box with known brand
  s.seek(0);
  s.setEndian("BE");
  const size = s.u32();
  const type = s.readString(4);
  if (type === "ftyp" && size >= 12 && size <= stream.size()) {
    const brand = s.readString(4);
    const heicBrands = new Set([
      "heic",
      "heix",
      "hevc",
      "hevx",
      "heim",
      "heis",
      "hevm",
      "hevs",
      "mif1",
      "msf1",
      "avif",
      "avis",
    ]);
    if (heicBrands.has(brand)) {
      return "heic";
    }
  }

  return "unknown";
}
