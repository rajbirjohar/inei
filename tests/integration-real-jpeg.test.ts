import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseExif } from "../src/index";
import { extractThumbnail } from "../src/thumbnail";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = resolve(here, "../demo/fixtures/photo.jpg");

describe("integration: real JPEG file", () => {
  it("parses demo/fixtures/photo.jpg successfully", async () => {
    const buf = await readFile(fixture);
    const res = parseExif(buf);

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }

    const { image, tags } = res.data;

    // Should extract image dimensions
    expect(image).toBeDefined();
    expect(image?.width).toBeGreaterThan(0);
    expect(image?.height).toBeGreaterThan(0);

    // Should have basic camera tags (most real JPEGs have these)
    expect(typeof tags.Make).toBe("string");
    expect(typeof tags.Model).toBe("string");
  });

  it("extracts thumbnail from real JPEG", async () => {
    const buf = await readFile(fixture);
    const res = parseExif(buf);

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }

    if (res.data.thumbnail) {
      const thumb = extractThumbnail(buf, res.data);
      expect(thumb).toBeDefined();
      if (thumb) {
        // JPEG thumbnails start with SOI marker 0xFFD8
        expect(thumb[0]).toBe(0xff);
        expect(thumb[1]).toBe(0xd8);
        expect(thumb.length).toBeGreaterThan(0);
      }
    }
  });

  it("returns parsed date tags as numbers (epoch seconds)", async () => {
    const buf = await readFile(fixture);
    const res = parseExif(buf);

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }

    const { tags } = res.data;

    // If date tags exist, they should be epoch-second numbers after simplification
    if (tags.DateTimeOriginal !== undefined) {
      expect(typeof tags.DateTimeOriginal).toBe("number");
    }
    if (tags.CreateDate !== undefined) {
      expect(typeof tags.CreateDate).toBe("number");
    }
  });

  it("produces formattedTags when includeFormatted is true", async () => {
    const buf = await readFile(fixture);
    const res = parseExif(buf, { includeFormatted: true });

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }

    const { formattedTags, tags } = res.data;
    expect(formattedTags).toBeDefined();

    // If the photo has ISO, it should appear formatted
    if (typeof tags.ISO === "number") {
      expect(formattedTags?.ISO).toBe(`ISO ${tags.ISO}`);
    }
    // If the photo has Make, it should pass through
    if (typeof tags.Make === "string") {
      expect(formattedTags?.Make).toBe(tags.Make);
    }
  });
});
