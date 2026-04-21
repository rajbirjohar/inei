import { describe, expect, it } from "vitest";
import { ByteStream } from "../src/byte-stream";
import { findHeicXmp, isHEIC } from "../src/heic";
import { parseExif } from "../src/index";

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

function be16(n: number): Uint8Array {
  const u = new Uint8Array(2);
  new DataView(u.buffer).setUint16(0, n, false);
  return u;
}

function ascii(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function nullTerminated(s: string): Uint8Array {
  const enc = new TextEncoder().encode(s);
  const out = new Uint8Array(enc.length + 1);
  out.set(enc);
  return out;
}

function makeBox(type: string, data: Uint8Array): Uint8Array {
  const size = 8 + data.length;
  return concat(be32(size), ascii(type), data);
}

function makeFullBox(
  type: string,
  version: number,
  flags: number,
  data: Uint8Array
): Uint8Array {
  const vf = new Uint8Array(4);
  // biome-ignore lint/suspicious/noBitwiseOperators: Building binary test data.
  new DataView(vf.buffer).setUint32(0, (version << 24) | flags, false);
  return makeBox(type, concat(vf, data));
}

describe("HEIC format detection", () => {
  it("detects heic ftyp", () => {
    const ftyp = makeBox("ftyp", concat(ascii("heic"), be32(0)));
    const stream = ByteStream.from(ftyp);
    expect(isHEIC(stream)).toBe(true);
  });

  it("detects mif1 ftyp", () => {
    const ftyp = makeBox("ftyp", concat(ascii("mif1"), be32(0)));
    expect(isHEIC(ByteStream.from(ftyp))).toBe(true);
  });

  it("detects avif ftyp", () => {
    const ftyp = makeBox("ftyp", concat(ascii("avif"), be32(0)));
    expect(isHEIC(ByteStream.from(ftyp))).toBe(true);
  });

  it("rejects non-HEIC ftyp", () => {
    const ftyp = makeBox("ftyp", concat(ascii("mp41"), be32(0)));
    expect(isHEIC(ByteStream.from(ftyp))).toBe(false);
  });

  it("rejects too-small input", () => {
    expect(isHEIC(ByteStream.from(new Uint8Array(4)))).toBe(false);
  });
});

describe("HEIC parseExif", () => {
  it("returns ok:true with empty tags for HEIC without exif data", () => {
    const ftyp = makeBox("ftyp", concat(ascii("heic"), be32(0)));
    const emptyMeta = makeFullBox("meta", 0, 0, new Uint8Array(0));
    const heic = concat(ftyp, emptyMeta);

    const result = parseExif(heic);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.data.tags).length).toBe(0);
    }
  });
});

describe("HEIC XMP extraction", () => {
  /**
   * Build a synthetic HEIC with an XMP mime item.
   * Structure: ftyp + meta(iinf(infe[mime]) + iloc(entry pointing to xmpBytes))
   */
  function buildHeicWithXmp(xml: string): Uint8Array {
    const xmpBytes = ascii(xml);
    const ftyp = makeBox("ftyp", concat(ascii("heic"), be32(0)));

    // infe for XMP: version=2, item_id=1, protection_index=0, item_type="mime", content_type="application/rdf+xml\0"
    const infeData = concat(
      be16(1), // item_id
      be16(0), // item_protection_index
      ascii("mime"), // item_type (4 bytes)
      nullTerminated("application/rdf+xml") // content_type (null-terminated)
    );
    const infe = makeFullBox("infe", 2, 0, infeData);

    // iinf: version=0, entry_count=1, then the infe box
    const iinfData = concat(be16(1), infe);
    const iinf = makeFullBox("iinf", 0, 0, iinfData);

    // iloc: version=0, offset_size=4, length_size=4, base_offset_size=0, item_count=1
    // Entry: item_id=1, data_reference_index=0, base_offset=0, extent_count=1, offset=TBD, length=xmpBytes.length
    // We'll compute the offset after assembling the meta box.
    //
    // iloc header: version(4) + sizes(2) + item_count(2) = 8 bytes
    // iloc entry: item_id(2) + data_ref(2) + extent_count(2) + offset(4) + length(4) = 14 bytes
    // iloc box overhead: 8 (box header) + 8 + 14 = 30 bytes total

    // To compute xmpBytes offset, we need to know the total size of ftyp + meta.
    // Let's place xmpBytes right after the meta box.
    // ftyp size = 8 + 8 = 16
    // meta box: fullbox header (8+4=12) + iinf + iloc
    // iinf size: 8 + 4 + 2 + infe_size
    // infe size: 8 + 4 + infeData.length

    const infeSize = 8 + 4 + infeData.length;
    const _iinfSize = 8 + 4 + 2 + infeSize;
    const _ilocBodySize = 4 + 2 + 2 + 2 + 2 + 4 + 4; // version+flags(4) + sizes(2) + item_count(2) + item_id(2) + data_ref(2) + offset(4) + length(4) + extent_count placeholder
    // Actually let me build iloc properly

    // iloc version=0: no construction_method
    // sizes byte 1: (offsetSize << 4) | lengthSize = (4 << 4) | 4 = 0x44
    // sizes byte 2: (baseOffsetSize << 4) | 0 = 0
    const ilocContent = concat(
      new Uint8Array([0x44]), // offset_size=4, length_size=4
      new Uint8Array([0x00]), // base_offset_size=0, index_size=0 (v0)
      be16(1), // item_count=1
      be16(1), // item_id=1
      be16(0), // data_reference_index=0
      be16(1), // extent_count=1
      be32(0), // extent_offset (placeholder — will patch)
      be32(xmpBytes.length) // extent_length
    );
    const iloc = makeFullBox("iloc", 0, 0, ilocContent);

    // meta = fullbox(version=0, flags=0, children=[iinf, iloc])
    const metaChildren = concat(iinf, iloc);
    const meta = makeFullBox("meta", 0, 0, metaChildren);

    // XMP data goes right after ftyp + meta
    const xmpOffset = ftyp.length + meta.length;

    // Patch the iloc extent_offset
    // In the assembled file: ftyp + meta(header=12 + iinf + iloc)
    // iloc extent_offset is at: ftyp.length + 12 (meta header) + iinf.length + 12 (iloc header+fullbox) + 6 (sizes+count) + 4 (item_id+data_ref) + 2 (extent_count)
    // = ftyp.length + 12 + iinfActual + 12 + 8 + 2
    // Actually it's easier to find and patch it in the output.
    const file = concat(ftyp, meta, xmpBytes);

    // Find "extent_offset" to patch: search for the placeholder be32(0) before be32(xmpBytes.length)
    // The iloc extent data is: be16(1) [extent_count] + be32(0) [offset] + be32(length)
    // Let's find the pattern by searching for the length value preceded by 4 zero bytes
    const lenBytes = be32(xmpBytes.length);
    for (let i = ftyp.length; i < file.length - 8; i++) {
      if (
        file[i] === 0 &&
        file[i + 1] === 0 &&
        file[i + 2] === 0 &&
        file[i + 3] === 0 &&
        file[i + 4] === lenBytes[0] &&
        file[i + 5] === lenBytes[1] &&
        file[i + 6] === lenBytes[2] &&
        file[i + 7] === lenBytes[3]
      ) {
        new DataView(file.buffer).setUint32(i, xmpOffset, false);
        break;
      }
    }

    return file;
  }

  it("extracts XMP from synthetic HEIC", () => {
    const xml =
      '<rdf:RDF><rdf:Description><dc:title><rdf:Alt><rdf:li xml:lang="x-default">HEIC Photo</rdf:li></rdf:Alt></dc:title></rdf:Description></rdf:RDF>';
    const heic = buildHeicWithXmp(xml);

    const result = parseExif(heic);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.xmp).toBeDefined();
    expect(result.data.xmp?.title).toBe("HEIC Photo");
  });

  it("findHeicXmp returns the raw XML string", () => {
    const xml = "<x:xmpmeta>test xmp</x:xmpmeta>";
    const heic = buildHeicWithXmp(xml);

    const xmpResult = findHeicXmp(ByteStream.from(heic));
    expect(xmpResult).toBe(xml);
  });

  it("findHeicXmp returns undefined when no XMP item", () => {
    const ftyp = makeBox("ftyp", concat(ascii("heic"), be32(0)));
    const emptyMeta = makeFullBox("meta", 0, 0, new Uint8Array(0));
    const heic = concat(ftyp, emptyMeta);

    expect(findHeicXmp(ByteStream.from(heic))).toBeUndefined();
  });
});
