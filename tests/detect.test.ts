import { describe, expect, it } from "vitest";
import { ByteStream } from "../src/byte-stream";
import { detectFormat } from "../src/detect";

describe("detectFormat", () => {
  it("detects JPEG from SOI marker", () => {
    const buf = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    expect(detectFormat(ByteStream.from(buf))).toBe("jpeg");
  });

  it("detects PNG from signature", () => {
    const buf = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
    ]);
    expect(detectFormat(ByteStream.from(buf))).toBe("png");
  });

  it("detects HEIC from ftyp box", () => {
    const buf = new Uint8Array(16);
    const dv = new DataView(buf.buffer);
    dv.setUint32(0, 16, false); // box size
    buf.set(new TextEncoder().encode("ftyp"), 4);
    buf.set(new TextEncoder().encode("heic"), 8);
    expect(detectFormat(ByteStream.from(buf))).toBe("heic");
  });

  it("detects AVIF from ftyp box", () => {
    const buf = new Uint8Array(16);
    const dv = new DataView(buf.buffer);
    dv.setUint32(0, 16, false);
    buf.set(new TextEncoder().encode("ftyp"), 4);
    buf.set(new TextEncoder().encode("avif"), 8);
    expect(detectFormat(ByteStream.from(buf))).toBe("heic");
  });

  it("returns unknown for unrecognized data", () => {
    const buf = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(detectFormat(ByteStream.from(buf))).toBe("unknown");
  });

  it("returns unknown for too-small input", () => {
    const buf = new Uint8Array([0xff, 0xd8]);
    expect(detectFormat(ByteStream.from(buf))).toBe("unknown");
  });
});
