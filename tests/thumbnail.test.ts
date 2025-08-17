import { describe, expect, it } from "vitest";
import { extractThumbnail } from "../src/thumbnail";
import type { ParsedExif } from "../src/types";

describe("extractThumbnail", () => {
	it("returns a slice at absolute offset", () => {
		const buf = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
		const exif: ParsedExif = {
			image: undefined,
			tags: {},
			tagsRaw: {},
			thumbnail: {
				type: 6,
				offsetFromTiff: 0,
				length: 3,
				absoluteOffset: 5,
			},
		};
		const t = extractThumbnail(buf, exif);
		expect(t).toEqual(new Uint8Array([6, 7, 8]));
	});

	it("returns undefined when absoluteOffset missing, length invalid, or out of range", () => {
		const buf = new Uint8Array(10);

		const noOffset: ParsedExif = {
			image: undefined,
			tags: {},
			tagsRaw: {},
			thumbnail: { type: 6, offsetFromTiff: 0, length: 3 },
		};
		expect(extractThumbnail(buf, noOffset)).toBeUndefined();

		const zeroLen: ParsedExif = {
			image: undefined,
			tags: {},
			tagsRaw: {},
			thumbnail: {
				type: 6,
				offsetFromTiff: 0,
				length: 0,
				absoluteOffset: 5,
			},
		};
		expect(extractThumbnail(buf, zeroLen)).toBeUndefined();
	});
});
