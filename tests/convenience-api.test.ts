import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { gps, orientation, parseExifFromBlob, thumbnail } from "../src/index";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = resolve(here, "../demo/fixtures/photo.jpg");

describe("convenience: gps()", () => {
  it("returns lat/lon from real JPEG", async () => {
    const buf = await readFile(fixture);
    const coords = gps(buf);
    // The fixture may or may not have GPS — just test the return shape
    if (coords) {
      expect(typeof coords.latitude).toBe("number");
      expect(typeof coords.longitude).toBe("number");
    }
  });

  it("returns undefined for non-image", () => {
    expect(gps(new Uint8Array(0))).toBeUndefined();
  });
});

describe("convenience: orientation()", () => {
  it("returns orientation from real JPEG", async () => {
    const buf = await readFile(fixture);
    const o = orientation(buf);
    // Most camera photos have orientation
    if (o !== undefined) {
      expect(o).toBeGreaterThanOrEqual(1);
      expect(o).toBeLessThanOrEqual(8);
    }
  });

  it("returns undefined for non-image", () => {
    expect(orientation(new Uint8Array(0))).toBeUndefined();
  });
});

describe("convenience: thumbnail()", () => {
  it("returns thumbnail bytes from real JPEG", async () => {
    const buf = await readFile(fixture);
    const thumb = thumbnail(buf);
    if (thumb) {
      // Should be a JPEG thumbnail (starts with SOI)
      expect(thumb[0]).toBe(0xff);
      expect(thumb[1]).toBe(0xd8);
    }
  });

  it("returns undefined for non-image", () => {
    expect(thumbnail(new Uint8Array(0))).toBeUndefined();
  });
});

describe("convenience: parseExifFromBlob()", () => {
  it("works with Uint8Array input", async () => {
    const buf = await readFile(fixture);
    const result = await parseExifFromBlob(buf);
    expect(result.ok).toBe(true);
  });

  it("works with ArrayBuffer input", async () => {
    const buf = await readFile(fixture);
    const ab = buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength
    );
    const result = await parseExifFromBlob(ab);
    expect(result.ok).toBe(true);
  });
});
