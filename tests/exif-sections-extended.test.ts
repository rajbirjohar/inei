import { describe, expect, it } from "vitest";
import { ByteStream } from "../src/byte-stream";
import { readValueByType, readValueInline } from "../src/exif-sections";
import { TiffType } from "../src/tiff-types";

describe("readValueByType: SLONG", () => {
  it("reads a single SLONG", () => {
    const buf = new Uint8Array(4);
    new DataView(buf.buffer).setInt32(0, -42, true);
    const s = new ByteStream(buf, "LE");
    const val = readValueByType(s, TiffType.SLONG, 1);
    expect(val).toBe(-42);
  });

  it("reads multiple SLONGs", () => {
    const buf = new Uint8Array(8);
    const dv = new DataView(buf.buffer);
    dv.setInt32(0, -100, true);
    dv.setInt32(4, 200, true);
    const s = new ByteStream(buf, "LE");
    const val = readValueByType(s, TiffType.SLONG, 2);
    expect(val).toEqual([-100, 200]);
  });
});

describe("readValueByType: SRATIONAL", () => {
  it("reads a single SRATIONAL pair", () => {
    const buf = new Uint8Array(8);
    const dv = new DataView(buf.buffer);
    dv.setInt32(0, -1, true);
    dv.setInt32(4, 3, true);
    const s = new ByteStream(buf, "LE");
    const val = readValueByType(s, TiffType.SRATIONAL, 1);
    expect(val).toEqual([-1, 3]);
  });

  it("reads multiple SRATIONAL pairs", () => {
    const buf = new Uint8Array(16);
    const dv = new DataView(buf.buffer);
    dv.setInt32(0, -1, true);
    dv.setInt32(4, 2, true);
    dv.setInt32(8, 3, true);
    dv.setInt32(12, -4, true);
    const s = new ByteStream(buf, "LE");
    const val = readValueByType(s, TiffType.SRATIONAL, 2);
    expect(val).toEqual([
      [-1, 2],
      [3, -4],
    ]);
  });
});

describe("readValueByType: UNDEFINED", () => {
  it("returns a Uint8Array slice", () => {
    const buf = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const s = new ByteStream(buf, "LE");
    const val = readValueByType(s, TiffType.UNDEFINED, 4);
    expect(val).toBeInstanceOf(Uint8Array);
    expect(val).toHaveLength(4);
  });
});

describe("readValueByType: BYTE", () => {
  it("reads a single byte", () => {
    const s = new ByteStream(new Uint8Array([0xff]), "LE");
    expect(readValueByType(s, TiffType.BYTE, 1)).toBe(0xff);
  });

  it("reads multiple bytes as array", () => {
    const s = new ByteStream(new Uint8Array([1, 2, 3]), "LE");
    expect(readValueByType(s, TiffType.BYTE, 3)).toEqual([1, 2, 3]);
  });
});

describe("readValueByType: unknown type", () => {
  it("returns undefined for unsupported types", () => {
    const s = new ByteStream(new Uint8Array(4), "LE");
    const val = readValueByType(s, 99 as TiffType, 1);
    expect(val).toBeUndefined();
  });
});

describe("readValueInline: LONG", () => {
  it("reads a single inline LONG", () => {
    const buf = new Uint8Array(4);
    new DataView(buf.buffer).setUint32(0, 12345, true);
    const s = new ByteStream(buf, "LE");
    expect(readValueInline(s, TiffType.LONG, 1)).toBe(12345);
  });
});

describe("readValueInline: unsupported type", () => {
  it("returns undefined for unsupported inline types", () => {
    const s = new ByteStream(new Uint8Array(4), "LE");
    expect(readValueInline(s, TiffType.RATIONAL, 1)).toBeUndefined();
  });
});
