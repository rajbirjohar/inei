// tests/offsets.test.ts
import { describe, expect, it } from "vitest";
import { applyExifOffsetTags } from "../src/offsets";

describe("offsets", () => {
	it("ignores invalid offset strings gracefully", () => {
		const tags: Record<string, unknown> = {
			DateTimeOriginal: 1_700_000_000,
			OffsetTimeOriginal: "weird",
		};
		applyExifOffsetTags(tags);
		// unchanged
		expect(tags.DateTimeOriginal).toBe(1_700_000_000);
	});
});
