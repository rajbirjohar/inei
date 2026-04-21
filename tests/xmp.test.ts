import { describe, expect, it } from "vitest";
import { ByteStream } from "../src/byte-stream";
import {
  extractXmpFromApp1,
  extractXmpFromPngITxt,
  isXmpApp1,
  parseXmp,
} from "../src/xmp";

const XMP_PREFIX = "http://ns.adobe.com/xap/1.0/\0";

function makeXmpApp1(xml: string): ByteStream {
  const enc = new TextEncoder();
  const prefix = enc.encode(XMP_PREFIX);
  const body = enc.encode(xml);
  const buf = new Uint8Array(prefix.length + body.length);
  buf.set(prefix);
  buf.set(body, prefix.length);
  return ByteStream.from(buf);
}

function makePngITxt(keyword: string, text: string): ByteStream {
  const enc = new TextEncoder();
  const kw = enc.encode(keyword);
  const txt = enc.encode(text);
  // keyword\0 + compressionFlag(0) + compressionMethod(0) + languageTag\0 + translatedKeyword\0 + text
  const buf = new Uint8Array(kw.length + 1 + 2 + 1 + 1 + txt.length);
  let o = 0;
  buf.set(kw, o);
  o += kw.length;
  buf[o++] = 0; // null terminator
  buf[o++] = 0; // compression flag
  buf[o++] = 0; // compression method
  buf[o++] = 0; // language tag (empty, null-terminated)
  buf[o++] = 0; // translated keyword (empty, null-terminated)
  buf.set(txt, o);
  return ByteStream.from(buf);
}

describe("XMP APP1 detection", () => {
  it("identifies XMP APP1 segment", () => {
    const section = makeXmpApp1("<x:xmpmeta/>");
    expect(isXmpApp1(section)).toBe(true);
  });

  it("rejects Exif APP1 segment", () => {
    const buf = new TextEncoder().encode("Exif\0\0...");
    expect(isXmpApp1(ByteStream.from(buf))).toBe(false);
  });

  it("rejects too-small segment", () => {
    expect(isXmpApp1(ByteStream.from(new Uint8Array(5)))).toBe(false);
  });
});

describe("extractXmpFromApp1", () => {
  it("extracts XML after prefix", () => {
    const xml = "<x:xmpmeta>test</x:xmpmeta>";
    const section = makeXmpApp1(xml);
    expect(extractXmpFromApp1(section)).toBe(xml);
  });

  it("returns undefined for non-XMP", () => {
    const buf = new TextEncoder().encode("Exif\0\0...");
    expect(extractXmpFromApp1(ByteStream.from(buf))).toBeUndefined();
  });
});

describe("extractXmpFromPngITxt", () => {
  it("extracts XMP from PNG iTXt chunk", () => {
    const xml = "<x:xmpmeta>png xmp</x:xmpmeta>";
    const data = makePngITxt("XML:com.adobe.xmp", xml);
    expect(extractXmpFromPngITxt(data)).toBe(xml);
  });

  it("returns undefined for non-XMP iTXt", () => {
    const data = makePngITxt("Comment", "hello world");
    expect(extractXmpFromPngITxt(data)).toBeUndefined();
  });
});

describe("parseXmp", () => {
  it("extracts Dublin Core title", () => {
    const xml = `<rdf:RDF>
      <rdf:Description>
        <dc:title><rdf:Alt><rdf:li xml:lang="x-default">My Photo</rdf:li></rdf:Alt></dc:title>
      </rdf:Description>
    </rdf:RDF>`;
    const data = parseXmp(xml);
    expect(data.title).toBe("My Photo");
  });

  it("extracts Dublin Core description", () => {
    const xml = `<rdf:Description>
      <dc:description><rdf:Alt><rdf:li xml:lang="x-default">Sunset at beach</rdf:li></rdf:Alt></dc:description>
    </rdf:Description>`;
    const data = parseXmp(xml);
    expect(data.description).toBe("Sunset at beach");
  });

  it("extracts Dublin Core subject (keywords)", () => {
    const xml = `<rdf:Description>
      <dc:subject><rdf:Bag>
        <rdf:li>landscape</rdf:li>
        <rdf:li>sunset</rdf:li>
        <rdf:li>ocean</rdf:li>
      </rdf:Bag></dc:subject>
    </rdf:Description>`;
    const data = parseXmp(xml);
    expect(data.subject).toEqual(["landscape", "sunset", "ocean"]);
  });

  it("extracts rating from attribute", () => {
    const xml = '<rdf:Description xmp:Rating="4"/>';
    const data = parseXmp(xml);
    expect(data.rating).toBe(4);
  });

  it("extracts rating from element", () => {
    const xml = "<rdf:Description><xmp:Rating>3</xmp:Rating></rdf:Description>";
    const data = parseXmp(xml);
    expect(data.rating).toBe(3);
  });

  it("extracts label", () => {
    const xml = "<rdf:Description><xmp:Label>Red</xmp:Label></rdf:Description>";
    const data = parseXmp(xml);
    expect(data.label).toBe("Red");
  });

  it("extracts createDate from attribute", () => {
    const xml = '<rdf:Description xmp:CreateDate="2023-10-01T12:00:00"/>';
    const data = parseXmp(xml);
    expect(data.createDate).toBe("2023-10-01T12:00:00");
  });

  it("extracts creator", () => {
    const xml = `<rdf:Description>
      <dc:creator><rdf:Seq><rdf:li>John Doe</rdf:li></rdf:Seq></dc:creator>
    </rdf:Description>`;
    const data = parseXmp(xml);
    expect(data.creator).toBe("John Doe");
  });

  it("returns empty object for empty XML", () => {
    const data = parseXmp("");
    expect(Object.keys(data)).toHaveLength(0);
  });
});
