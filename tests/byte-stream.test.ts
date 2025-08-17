// tests/byte-stream.test.ts
import { describe, expect, it } from "vitest";
import { ByteStream } from "../src/byte-stream";

describe("ByteStream", () => {
	it("reads LE and BE correctly", () => {
		const u8 = new Uint8Array([0x01, 0x00, 0x02, 0x00, 0x78, 0x56, 0x34, 0x12]);
		const le = new ByteStream(u8, "LE");
		expect(le.u16()).toBe(1);
		expect(le.u16()).toBe(2);
		expect(le.u32()).toBe(0x12345678);

		const be = new ByteStream(u8, "BE");
		expect(be.u16()).toBe(0x0100);
		expect(be.u16()).toBe(0x0200);
		expect(typeof be.u32()).toBe("number");
	});

	it("branch uses absolute offset from view start (not parent cursor)", () => {
		const u8 = new Uint8Array([10, 20, 30, 40, 50]);
		const base = new ByteStream(u8, "LE", 1000);

		// cursor now 2, but branch is absolute
		base.skip(2);

		const child = base.branch(1, 2); // bytes [20,30]
		expect(child.baseOffset()).toBe(1001); // parent.base + branchOffset
		expect(child.u8()).toBe(20);
		expect(child.u8()).toBe(30);
		expect(() => child.u8()).toThrow();

		// extra coverage of signed reads / errors
		const signed = new ByteStream(
			new Uint8Array([0xff, 0x00, 0xff, 0x7f]),
			"LE",
		);
		expect(signed.i8()).toBe(-1);
		expect(signed.i8()).toBe(0);
		const s16 = new ByteStream(new Uint8Array([0xff, 0xff]), "LE");
		expect(s16.i16()).toBe(-1);
		const s32 = new ByteStream(new Uint8Array([0xff, 0xff, 0xff, 0x7f]), "LE");
		expect(s32.i32()).toBe(2147483647);
		const r = new ByteStream(new Uint8Array([65, 66, 67, 0]), "LE");
		expect(r.readString(4)).toBe("ABC\u0000");
		const slice = new ByteStream(new Uint8Array([1, 2, 3, 4]), "LE");
		expect(Array.from(slice.slice(3))).toEqual([1, 2, 3]);
		expect(() => slice.slice(5)).toThrow("slice OOB: len=5, remaining=1");

		const tooShort = new ByteStream(new Uint8Array([1]), "LE");
		expect(() => tooShort.u16()).toThrow();
	});
});
