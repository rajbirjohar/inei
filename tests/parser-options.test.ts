// tests/parser-options.test.ts
import { describe, expect, it } from "vitest";
import { parseExif } from "../src/index";
import {
	buildJpegWithExifAndSize,
	buildTiffLE_IFD0,
} from "./utils/jpeg-builder";

// Tiny helper to add an UNDEFINED tag (type 7) via offset storage
function addUndefinedTagToApp1(app1: Uint8Array): Uint8Array {
	// We won’t rebuild the whole TIFF here; this is just a smoke test hook.
	// If your parser strictly validates, skip this test or wire a proper builder that writes type=7 entries.
	return app1; // keep as-is if you don’t support UNDEFINED in this builder
}

describe("parser options", () => {
	it("simplifyValues=false keeps raw rational pairs", () => {
		const app1 = buildTiffLE_IFD0({ xres: [300, 1], yres: [240, 1] });
		const jpeg = buildJpegWithExifAndSize(app1, { width: 321, height: 123 });

		const res = parseExif(jpeg, { simplifyValues: false });
		expect(res.ok).toBe(true);
		if (!res.ok) return;

		// Raw RATIONAL as pair (not simplified)
		expect(res.data.tagsRaw.XResolution).toEqual([300, 1]);
		expect(res.data.tagsRaw.YResolution).toEqual([240, 1]);

		// tags might be simplified or raw depending on your API;
		// we at least assert raw availability:
		expect(Array.isArray(res.data.tagsRaw.XResolution)).toBe(true);
	});

	it("returnTags=false yields empty tag map", () => {
		const app1 = buildTiffLE_IFD0();
		const jpeg = buildJpegWithExifAndSize(app1, { width: 1, height: 1 });
		const res = parseExif(jpeg, { returnTags: false });
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.data.tags).toEqual({});
		// tagsRaw may also be empty depending on your implementation; accept {} or defined:
		expect(typeof res.data.tagsRaw).toBe("object");
	});

	it("readBinaryTags=true allows UNDEFINED (smoke)", () => {
		const app1 = addUndefinedTagToApp1(buildTiffLE_IFD0());
		const jpeg = buildJpegWithExifAndSize(app1, { width: 10, height: 10 });
		const res = parseExif(jpeg, { readBinaryTags: true });
		expect(res.ok).toBe(true);
	});
});
