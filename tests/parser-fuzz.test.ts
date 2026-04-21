import { describe, expect, it } from "vitest";
import { parseExif } from "../src/index";

describe("parseExif: adversarial inputs", () => {
  it("returns ok:false for empty buffer", () => {
    const res = parseExif(new Uint8Array(0));
    expect(res.ok).toBe(false);
  });

  it("returns ok:false for 1 byte", () => {
    const res = parseExif(new Uint8Array([0xff]));
    expect(res.ok).toBe(false);
  });

  it("returns ok:false for valid SOI but truncated", () => {
    // Valid JPEG SOI + APP1 marker but no length
    const res = parseExif(new Uint8Array([0xff, 0xd8, 0xff, 0xe1]));
    expect(res.ok).toBe(false);
  });

  it("does not throw for random bytes", () => {
    const random = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      random[i] = Math.floor(Math.random() * 256);
    }
    // Should never throw, always return a result
    const res = parseExif(random);
    expect(typeof res.ok).toBe("boolean");
  });

  it("handles JPEG with non-Exif APP1 gracefully", () => {
    // SOI + APP1 with "JFIF" instead of "Exif"
    const buf = new Uint8Array([
      0xff,
      0xd8, // SOI
      0xff,
      0xe1, // APP1
      0x00,
      0x08, // length = 8 (includes length bytes)
      0x4a,
      0x46,
      0x49,
      0x46,
      0x00,
      0x00, // "JFIF\0\0"
      0xff,
      0xd9, // EOI
    ]);
    const res = parseExif(buf);
    // Should succeed but with no meaningful tags
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(Object.keys(res.data.tags).length).toBe(0);
    }
  });
});
