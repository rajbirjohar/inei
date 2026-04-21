import { describe, expect, it } from "vitest";
import { ByteStream } from "../src/byte-stream";
import { parseExif } from "../src/index";
import { findExifChunk, isPNG, readPngChunks, readPngSize } from "../src/png";

function concat(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function be32(n: number): Uint8Array {
  const u = new Uint8Array(4);
  new DataView(u.buffer).setUint32(0, n, false);
  return u;
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  // CRC placeholder (4 bytes of zeros — we don't validate CRC)
  return concat(be32(data.length), typeBytes, data, new Uint8Array(4));
}

const PNG_SIG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function makeMinimalPng(opts?: {
  width?: number;
  height?: number;
  exifTiff?: Uint8Array;
}): Uint8Array {
  const width = opts?.width ?? 100;
  const height = opts?.height ?? 50;

  // IHDR: width(4) + height(4) + bitDepth(1) + colorType(1) + compression(1) + filter(1) + interlace(1)
  const ihdrData = new Uint8Array(13);
  const dv = new DataView(ihdrData.buffer);
  dv.setUint32(0, width, false);
  dv.setUint32(4, height, false);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type (RGB)

  const chunks = [makeChunk("IHDR", ihdrData)];

  if (opts?.exifTiff) {
    chunks.push(makeChunk("eXIf", opts.exifTiff));
  }

  chunks.push(makeChunk("IEND", new Uint8Array(0)));

  return concat(PNG_SIG, ...chunks);
}

// Build a minimal TIFF with just a Make tag (same IFD structure as JPEG exif)
function buildMinimalTiff(make: string): Uint8Array {
  const enc = new TextEncoder();
  const makeBytes = new Uint8Array(make.length + 1);
  makeBytes.set(enc.encode(make));
  makeBytes[make.length] = 0;

  // TIFF header: "II" (LE), magic 42, offset to IFD0 = 8
  const header = new Uint8Array(8);
  header.set(enc.encode("II"));
  new DataView(header.buffer).setUint16(2, 42, true);
  new DataView(header.buffer).setUint32(4, 8, true);

  // IFD0: 1 entry
  const numEntries = new Uint8Array(2);
  new DataView(numEntries.buffer).setUint16(0, 1, true);

  // Entry: Make (0x010F), ASCII (2), count, offset to data area
  const entry = new Uint8Array(12);
  const edv = new DataView(entry.buffer);
  edv.setUint16(0, 0x010f, true); // tag
  edv.setUint16(2, 2, true); // type = ASCII
  edv.setUint32(4, makeBytes.length, true); // count

  // Data area starts after header(8) + numEntries(2) + entry(12) + nextIFD(4) = 26
  const dataOffset = 26;
  if (makeBytes.length <= 4) {
    // inline
    entry.set(makeBytes.subarray(0, 4), 8);
  } else {
    edv.setUint32(8, dataOffset, true);
  }

  const nextIFD = new Uint8Array(4); // 0 = no next IFD

  if (makeBytes.length <= 4) {
    return concat(header, numEntries, entry, nextIFD);
  }
  return concat(header, numEntries, entry, nextIFD, makeBytes);
}

describe("PNG format detection", () => {
  it("isPNG detects valid PNG", () => {
    const png = makeMinimalPng();
    expect(isPNG(ByteStream.from(png))).toBe(true);
  });

  it("isPNG rejects non-PNG", () => {
    expect(isPNG(ByteStream.from(new Uint8Array([0xff, 0xd8])))).toBe(false);
  });
});

describe("PNG chunk reading", () => {
  it("reads IHDR and IEND chunks", () => {
    const png = makeMinimalPng();
    const chunks: string[] = [];
    readPngChunks(ByteStream.from(png), (type) => {
      chunks.push(type);
    });
    expect(chunks).toContain("IHDR");
    expect(chunks).toContain("IEND");
  });

  it("reads image size from IHDR", () => {
    const png = makeMinimalPng({ width: 640, height: 480 });
    const size = readPngSize(ByteStream.from(png));
    expect(size).toEqual({ width: 640, height: 480 });
  });
});

describe("PNG EXIF extraction", () => {
  it("finds eXIf chunk and reads TIFF data", () => {
    const tiff = buildMinimalTiff("TestCam");
    const png = makeMinimalPng({ exifTiff: tiff });
    const stream = ByteStream.from(png);
    const exifChunk = findExifChunk(stream);
    expect(exifChunk).toBeDefined();
  });

  it("parseExif works on PNG with eXIf chunk", () => {
    const tiff = buildMinimalTiff("PngCamera");
    const png = makeMinimalPng({ width: 1920, height: 1080, exifTiff: tiff });

    const result = parseExif(png);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.image).toEqual({ width: 1920, height: 1080 });
    expect(result.data.tags.Make).toBe("PngCamera");
  });

  it("parseExif returns ok:true with empty tags for PNG without eXIf", () => {
    const png = makeMinimalPng();
    const result = parseExif(png);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.image).toEqual({ width: 100, height: 50 });
    expect(Object.keys(result.data.tags).length).toBe(0);
  });
});
