// tests/simplify-gps-date.test.ts
import { describe, expect, it } from "vitest";
import { castDateValues, castDegreeValues } from "../src/simplify";

describe("simplify: GPS + date casters", () => {
	it("casts GPS degrees with ref sign", () => {
		const tags: Record<string, unknown> = {
			GPSLatitude: [10, 30, 0],
			GPSLatitudeRef: "S", // south => negative
		};
		const get = (q: { name?: string }) => (q.name ? tags[q.name] : undefined);
		const set = (q: { name?: string }, v: unknown) => {
			if (q.name) tags[q.name] = v;
		};
		castDegreeValues(get, set);
		expect(tags.GPSLatitude).toBeCloseTo(-10.5, 6);
	});

	it("casts EXIF spec dates to epoch", () => {
		const tags: Record<string, unknown> = {
			DateTimeOriginal: "2020:01:02 03:04:05",
		};
		const get = (q: { name?: string }) => (q.name ? tags[q.name] : undefined);
		const set = (q: { name?: string }, v: unknown) => {
			if (q.name) tags[q.name] = v;
		};
		castDateValues(get, set);
		expect(typeof tags.DateTimeOriginal).toBe("number");
	});
});
