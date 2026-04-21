import { describe, expect, it } from "vitest";
import { ByteStream } from "../src/byte-stream";

describe("ByteStream: signed and float reads", () => {
  it("reads i8 (signed byte)", () => {
    const buf = new Uint8Array([0xff, 0x7f, 0x80]);
    const s = new ByteStream(buf, "LE");
    expect(s.i8()).toBe(-1);
    expect(s.i8()).toBe(127);
    expect(s.i8()).toBe(-128);
  });

  it("reads i16 little-endian", () => {
    const buf = new Uint8Array(4);
    const dv = new DataView(buf.buffer);
    dv.setInt16(0, -1234, true);
    dv.setInt16(2, 32000, true);
    const s = new ByteStream(buf, "LE");
    expect(s.i16()).toBe(-1234);
    expect(s.i16()).toBe(32000);
  });

  it("reads i16 big-endian", () => {
    const buf = new Uint8Array(2);
    new DataView(buf.buffer).setInt16(0, -5678, false);
    const s = new ByteStream(buf, "BE");
    expect(s.i16()).toBe(-5678);
  });

  it("reads f32", () => {
    const buf = new Uint8Array(4);
    new DataView(buf.buffer).setFloat32(0, 3.14, true);
    const s = new ByteStream(buf, "LE");
    expect(s.f32()).toBeCloseTo(3.14, 2);
  });

  it("reads f64", () => {
    const buf = new Uint8Array(8);
    new DataView(buf.buffer).setFloat64(0, Math.PI, true);
    const s = new ByteStream(buf, "LE");
    expect(s.f64()).toBeCloseTo(Math.PI, 10);
  });

  it("reads peekU16 without advancing position", () => {
    const buf = new Uint8Array(4);
    new DataView(buf.buffer).setUint16(0, 0xabcd, true);
    const s = new ByteStream(buf, "LE");

    const peeked = s.peekU16();
    expect(peeked).toBe(0xabcd);
    // Position should not have advanced
    expect(s.tell()).toBe(0);
    // Normal read should still work
    expect(s.u16()).toBe(0xabcd);
    expect(s.tell()).toBe(2);
  });
});

describe("ByteStream: bounds checking", () => {
  it("throws on seek out of bounds", () => {
    const s = new ByteStream(new Uint8Array(4), "LE");
    expect(() => s.seek(-1)).toThrow("seek OOB");
    expect(() => s.seek(5)).toThrow("seek OOB");
  });

  it("throws on branch out of bounds", () => {
    const s = new ByteStream(new Uint8Array(4), "LE");
    expect(() => s.branch(-1)).toThrow();
    expect(() => s.branch(2, 5)).toThrow("branch OOB");
  });

  it("throws on slice out of bounds", () => {
    const s = new ByteStream(new Uint8Array(4), "LE");
    expect(() => s.slice(5)).toThrow("slice OOB");
    expect(() => s.slice(-1)).toThrow("slice OOB");
  });

  it("throws on read past end", () => {
    const s = new ByteStream(new Uint8Array(1), "LE");
    s.u8(); // consume the one byte
    expect(() => s.u8()).toThrow("read OOB");
  });
});

describe("ByteStream: endianness", () => {
  it("flipEndian toggles between LE and BE", () => {
    const s = new ByteStream(new Uint8Array(2), "LE");
    expect(s.endianness()).toBe("LE");
    expect(s.isLittleEndian()).toBe(true);
    s.flipEndian();
    expect(s.endianness()).toBe("BE");
    expect(s.isLittleEndian()).toBe(false);
  });
});

describe("ByteStream: mark and reopen", () => {
  it("mark captures position and reopen returns a branch", () => {
    const buf = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const s = new ByteStream(buf, "LE");
    s.skip(2);
    const m = s.mark();
    expect(m.offset).toBe(2);

    const reopened = m.reopen();
    expect(reopened.tell()).toBe(0);
    expect(reopened.u8()).toBe(3); // byte at offset 2 in original
  });
});

describe("ByteStream.from", () => {
  it("creates from ArrayBuffer", () => {
    const ab = new ArrayBuffer(4);
    new DataView(ab).setUint8(0, 42);
    const s = ByteStream.from(ab, "LE");
    expect(s.u8()).toBe(42);
  });

  it("throws for unsupported types", () => {
    expect(() =>
      ByteStream.from("not a buffer" as unknown as ArrayBuffer)
    ).toThrow("Unsupported input type");
  });
});
