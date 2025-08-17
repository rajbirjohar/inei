import { describe, expect, it } from "vitest";
import { parseExif } from "../src/index";

describe("parseExif error path", () => {
	it("returns ok:false for non-JPEG input", () => {
		const junk = new Uint8Array([0, 1, 2, 3, 4, 5]); // missing SOI
		const res = parseExif(junk);
		expect(res.ok).toBe(false);
	});
});
