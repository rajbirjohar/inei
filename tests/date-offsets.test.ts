import { describe, expect, it } from "vitest";
import { applyExifOffsetTags } from "../src/offsets";

describe("applyExifOffsetTags", () => {
	it("adjusts DateTime* by OffsetTime* (to true UTC)", () => {
		const tags: Record<string, unknown> = {
			DateTimeOriginal: 1_700_000_000,
			OffsetTimeOriginal: "+02:30",
			ModifyDate: 1_700_000_100,
			OffsetTime: "-01:00",
		};
		applyExifOffsetTags(tags);
		expect(tags.DateTimeOriginal).toBe(1_700_000_000 - (2 * 3600 + 30 * 60));
		expect(tags.ModifyDate).toBe(1_700_000_100 - -1 * 3600);
	});
});
