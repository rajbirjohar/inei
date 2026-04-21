import type { ByteStream } from "./byte-stream";

/**
 * @module xmp
 * Minimal XMP (Extensible Metadata Platform) parser.
 *
 * XMP is XML metadata stored in:
 * - JPEG: APP1 segment starting with "http://ns.adobe.com/xap/1.0/\0"
 * - PNG: iTXt chunk with keyword "XML:com.adobe.xmp"
 *
 * This parser extracts common Dublin Core and XMP fields using targeted
 * string matching (no full XML parser needed for the common cases).
 */

export interface XmpData {
  createDate?: string;
  creator?: string;
  description?: string;
  label?: string;
  rating?: number;
  subject?: string[];
  title?: string;
}

const XMP_JPEG_PREFIX = "http://ns.adobe.com/xap/1.0/\0";
const XMP_PNG_KEYWORD = "XML:com.adobe.xmp";

// Hoisted regexes for lint/performance
const RATING_ATTR_RE = /xmp:Rating\s*=\s*"(\d+)"/;
const CREATE_DATE_ATTR_RE = /xmp:CreateDate\s*=\s*"([^"]+)"/;
const RDF_LI_RE = /<rdf:li[^>]*>([^<]+)<\/rdf:li>/gi;

/**
 * Check if a JPEG APP1 segment contains XMP data (not EXIF).
 */
export function isXmpApp1(section: ByteStream): boolean {
  if (section.size() < XMP_JPEG_PREFIX.length) {
    return false;
  }
  const s = section.branch(0);
  const prefix = s.readString(XMP_JPEG_PREFIX.length);
  return prefix === XMP_JPEG_PREFIX;
}

/**
 * Extract the XMP XML string from a JPEG APP1 section.
 */
export function extractXmpFromApp1(section: ByteStream): string | undefined {
  if (!isXmpApp1(section)) {
    return;
  }
  const s = section.branch(0);
  s.skip(XMP_JPEG_PREFIX.length);
  const remaining = s.remaining();
  if (remaining <= 0) {
    return;
  }
  return s.readString(remaining);
}

/** Read a null-terminated string from a ByteStream. */
function readNullTerminated(s: ByteStream): string {
  let out = "";
  while (s.remaining() > 0) {
    const ch = s.u8();
    if (ch === 0) {
      break;
    }
    out += String.fromCharCode(ch);
  }
  return out;
}

/**
 * Extract the XMP XML string from a PNG iTXt chunk data.
 * The iTXt chunk data format: keyword\0 compressionFlag\0 compressionMethod\0 languageTag\0 translatedKeyword\0 text
 */
export function extractXmpFromPngITxt(data: ByteStream): string | undefined {
  const s = data.branch(0);

  const keyword = readNullTerminated(s);
  if (keyword !== XMP_PNG_KEYWORD) {
    return;
  }

  // compression flag (1 byte) + compression method (1 byte)
  if (s.remaining() < 2) {
    return;
  }
  const compressionFlag = s.u8();
  s.skip(1); // compression method

  // We don't support compressed XMP (rare in practice)
  if (compressionFlag !== 0) {
    return;
  }

  // Skip language tag (null-terminated)
  readNullTerminated(s);
  // Skip translated keyword (null-terminated)
  readNullTerminated(s);

  // Remaining bytes are the XMP XML
  const remaining = s.remaining();
  if (remaining <= 0) {
    return;
  }
  return s.readString(remaining);
}

/** Extract text content from a simple XML element. Handles both <tag>text</tag> and <tag><rdf:li>text</rdf:li></tag>. */
function extractSimple(xml: string, tag: string): string | undefined {
  // Try direct text content: <tag>text</tag>
  const directRe = new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, "i");
  const directMatch = directRe.exec(xml);
  if (directMatch?.[1]) {
    return directMatch[1].trim();
  }

  // Try rdf:li content: <tag><rdf:Alt><rdf:li ...>text</rdf:li></rdf:Alt></tag>
  const rdfRe = new RegExp(
    `<${tag}[^>]*>[\\s\\S]*?<rdf:li[^>]*>([^<]+)</rdf:li>[\\s\\S]*?</${tag}>`,
    "i"
  );
  const rdfMatch = rdfRe.exec(xml);
  if (rdfMatch?.[1]) {
    return rdfMatch[1].trim();
  }

  return;
}

/** Extract all rdf:li items from a Bag or Seq inside a tag. */
function extractBag(xml: string, tag: string): string[] | undefined {
  const bagRe = new RegExp(
    `<${tag}[^>]*>[\\s\\S]*?<rdf:(?:Bag|Seq)>([\\s\\S]*?)</rdf:(?:Bag|Seq)>[\\s\\S]*?</${tag}>`,
    "i"
  );
  const match = bagRe.exec(xml);
  if (!match?.[1]) {
    return;
  }

  const items: string[] = [];
  RDF_LI_RE.lastIndex = 0;
  let m = RDF_LI_RE.exec(match[1]);
  while (m !== null) {
    if (m[1]) {
      items.push(m[1].trim());
    }
    m = RDF_LI_RE.exec(match[1]);
  }

  return items.length > 0 ? items : undefined;
}

/** Extract rating from XMP attribute or element. */
function extractRating(xml: string): number | undefined {
  const attrMatch = RATING_ATTR_RE.exec(xml);
  if (attrMatch?.[1]) {
    return Number.parseInt(attrMatch[1], 10);
  }
  const tagVal = extractSimple(xml, "xmp:Rating");
  if (tagVal) {
    const n = Number.parseInt(tagVal, 10);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return;
}

/** Extract createDate from XMP attribute or element. */
function extractCreateDate(xml: string): string | undefined {
  const attrMatch = CREATE_DATE_ATTR_RE.exec(xml);
  if (attrMatch?.[1]) {
    return attrMatch[1];
  }
  return extractSimple(xml, "xmp:CreateDate");
}

/**
 * Parse an XMP XML string into structured data.
 * Extracts common Dublin Core and XMP basic fields.
 */
export function parseXmp(xml: string): XmpData {
  const data: XmpData = {};

  const title = extractSimple(xml, "dc:title");
  if (title) {
    data.title = title;
  }

  const description = extractSimple(xml, "dc:description");
  if (description) {
    data.description = description;
  }

  const creator = extractSimple(xml, "dc:creator");
  if (creator) {
    data.creator = creator;
  }

  const subject = extractBag(xml, "dc:subject");
  if (subject) {
    data.subject = subject;
  }

  const rating = extractRating(xml);
  if (rating !== undefined) {
    data.rating = rating;
  }

  const label = extractSimple(xml, "xmp:Label");
  if (label) {
    data.label = label;
  }

  const createDate = extractCreateDate(xml);
  if (createDate) {
    data.createDate = createDate;
  }

  return data;
}
