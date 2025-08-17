import { describe, expect, it } from "vitest";
import { TiffType } from "../src/exif-sections";
import { simplifyRationals } from "../src/simplify";

describe("simplifyRationals", () => {
	it("pair → number", () => {
		expect(simplifyRationals([18, 10], TiffType.RATIONAL)).toBe(1.8);
	});
	it("array of pairs → number[]", () => {
		expect(
			simplifyRationals(
				[
					[240, 1],
					[300, 1],
				],
				TiffType.RATIONAL,
			),
		).toEqual([240, 300]);
	});
	it("0 denominator → null by default", () => {
		expect(simplifyRationals([0, 0], TiffType.RATIONAL)).toBeNull();
	});
	it("passes through non-rational shapes", () => {
		// @ts-expect-no-error runtime
		expect(simplifyRationals("abc" as any, TiffType.RATIONAL)).toBe("abc");
	});
});
