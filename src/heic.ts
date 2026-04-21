/** biome-ignore-all lint/suspicious/noBitwiseOperators: Required for binary ISOBMFF parsing. */

import type { ByteStream } from "./byte-stream";
import type { ImageSize } from "./types";

/**
 * @module heic
 * HEIC/HEIF ISOBMFF box parser. Navigates the box tree to extract EXIF data.
 *
 * HEIC uses the ISO Base Media File Format (ISO 14496-12). EXIF data is stored
 * as an item in the meta box hierarchy:
 *   ftyp → meta → iinf (find Exif item_id) → iloc (find offset+length) → TIFF bytes
 *
 * The EXIF payload has a 4-byte prefix (offset to TIFF header), then standard
 * TIFF data identical to JPEG/PNG EXIF.
 */

const HEIC_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
  "avif",
  "avis",
]);

/** Check if the file starts with an ftyp box with a HEIC/HEIF/AVIF brand. */
export function isHEIC(stream: ByteStream): boolean {
  if (stream.size() < 12) {
    return false;
  }
  const s = stream.branch(0);
  s.setEndian("BE");
  const size = s.u32();
  const type = s.readString(4);
  if (type !== "ftyp" || size < 12 || size > stream.size()) {
    return false;
  }
  const majorBrand = s.readString(4);
  return HEIC_BRANDS.has(majorBrand);
}

interface Box {
  dataLength: number;
  dataOffset: number;
  type: string;
}

/** Read a single ISOBMFF box header, returning type and data range. */
function readBoxHeader(s: ByteStream): Box | undefined {
  if (s.remaining() < 8) {
    return;
  }
  const startPos = s.tell();
  let size = s.u32();
  const type = s.readString(4);

  if (size === 1) {
    // 64-bit extended size — read high 32 and low 32
    if (s.remaining() < 8) {
      return;
    }
    const hi = s.u32();
    const lo = s.u32();
    // We only support files up to ~4GB in practice
    size = hi > 0 ? Number.MAX_SAFE_INTEGER : lo;
  }

  const headerSize = s.tell() - startPos;
  const dataLength = size === 0 ? s.remaining() : size - headerSize;

  return { type, dataOffset: s.tell(), dataLength };
}

// biome-ignore lint/suspicious/noConfusingVoidType: Callback must accept void returns from visitors that don't signal stop.
type BoxVisitor = (box: Box, boxData: ByteStream) => boolean | void;

/** Iterate top-level boxes in a range, calling visitor for each. */
function walkBoxes(stream: ByteStream, visitor: BoxVisitor): void {
  const s = stream.branch(0);
  s.setEndian("BE");

  while (s.remaining() >= 8) {
    const box = readBoxHeader(s);
    if (!box || box.dataLength < 0) {
      break;
    }

    const clampedLen = Math.min(box.dataLength, s.remaining());
    const boxData = s.branch(s.tell(), clampedLen);
    const stop = visitor(box, boxData);
    s.skip(clampedLen);

    if (stop) {
      break;
    }
  }
}

/** Walk child boxes inside a container box (meta, iprp, etc.). */
function walkChildBoxes(data: ByteStream, visitor: BoxVisitor): void {
  const s = data.branch(0);
  s.setEndian("BE");

  while (s.remaining() >= 8) {
    const box = readBoxHeader(s);
    if (!box || box.dataLength < 0) {
      break;
    }

    const clampedLen = Math.min(box.dataLength, s.remaining());
    const boxData = s.branch(s.tell(), clampedLen);
    const stop = visitor(box, boxData);
    s.skip(clampedLen);

    if (stop) {
      break;
    }
  }
}

interface IlocEntry {
  baseOffset: number;
  constructionMethod: number;
  dataReferenceIndex: number;
  extents: Array<{ offset: number; length: number }>;
  itemId: number;
}

/** Parse the iloc box to get item locations. */
function parseIloc(data: ByteStream): IlocEntry[] {
  const s = data.branch(0);
  s.setEndian("BE");

  const versionFlags = s.u32();
  const version = (versionFlags >>> 24) & 0xff;

  const sizeByte1 = s.u8();
  const offsetSize = (sizeByte1 >>> 4) & 0x0f;
  const lengthSize = sizeByte1 & 0x0f;

  const sizeByte2 = s.u8();
  const baseOffsetSize = (sizeByte2 >>> 4) & 0x0f;
  const indexSize = version >= 1 ? sizeByte2 & 0x0f : 0;

  const itemCount = version < 2 ? s.u16() : s.u32();
  const entries: IlocEntry[] = [];

  for (let i = 0; i < itemCount; i++) {
    const itemId = version < 2 ? s.u16() : s.u32();

    let constructionMethod = 0;
    if (version >= 1) {
      const cm = s.u16();
      constructionMethod = cm & 0x0f;
    }

    const dataReferenceIndex = s.u16();
    const baseOffset = readSizedInt(s, baseOffsetSize);

    const extentCount = s.u16();
    const extents: Array<{ offset: number; length: number }> = [];

    for (let j = 0; j < extentCount; j++) {
      if (version >= 1 && indexSize > 0) {
        readSizedInt(s, indexSize); // extent_index, skip
      }
      const offset = readSizedInt(s, offsetSize);
      const length = readSizedInt(s, lengthSize);
      extents.push({ offset, length });
    }

    entries.push({
      itemId,
      constructionMethod,
      dataReferenceIndex,
      baseOffset,
      extents,
    });
  }

  return entries;
}

/** Read a variable-width integer (0, 2, or 4 bytes). */
function readSizedInt(s: ByteStream, size: number): number {
  switch (size) {
    case 0:
      return 0;
    case 2:
      return s.u16();
    case 4:
      return s.u32();
    case 8: {
      const hi = s.u32();
      const lo = s.u32();
      return hi > 0 ? Number.MAX_SAFE_INTEGER : lo;
    }
    default:
      return 0;
  }
}

interface InfeItem {
  contentType?: string;
  itemId: number;
  itemType: string;
}

/** Read a null-terminated string, consuming at most `maxBytes` bytes. */
function readNullTermStr(s: ByteStream, maxBytes: number): string {
  let out = "";
  for (let i = 0; i < maxBytes && s.remaining() > 0; i++) {
    const ch = s.u8();
    if (ch === 0) {
      break;
    }
    out += String.fromCharCode(ch);
  }
  return out;
}

/** Parse a single infe entry at the current stream position. */
function parseInfe(
  s: ByteStream,
  entryStart: number,
  entrySize: number
): InfeItem {
  const entryVersionFlags = s.u32();
  const entryVersion = (entryVersionFlags >>> 24) & 0xff;

  const itemId = entryVersion >= 3 ? s.u32() : s.u16();
  s.skip(2); // item_protection_index

  let itemType: string;
  if (entryVersion >= 2) {
    itemType = s.readString(4);
  } else {
    itemType = readNullTermStr(s, entrySize);
  }

  let contentType: string | undefined;
  if (itemType === "mime" && entryVersion >= 2) {
    const consumed = s.tell() - entryStart;
    const left = entrySize - consumed;
    if (left > 0) {
      contentType = readNullTermStr(s, left);
    }
  }

  return { itemId, itemType, contentType };
}

/** Parse all infe entries from the iinf box. */
function parseIinf(data: ByteStream): InfeItem[] {
  const s = data.branch(0);
  s.setEndian("BE");

  const versionFlags = s.u32();
  const version = (versionFlags >>> 24) & 0xff;

  const entryCount = version === 0 ? s.u16() : s.u32();
  const items: InfeItem[] = [];

  for (let i = 0; i < entryCount; i++) {
    if (s.remaining() < 8) {
      break;
    }

    const entryStart = s.tell();
    const entrySize = s.u32();
    const entryType = s.readString(4);

    if (entryType !== "infe" || entrySize < 12) {
      const skip = entrySize - 8;
      if (skip > 0 && skip <= s.remaining()) {
        s.skip(skip);
      }
      continue;
    }

    items.push(parseInfe(s, entryStart, entrySize));

    // Skip to end of entry
    const consumed = s.tell() - entryStart;
    const leftover = entrySize - consumed;
    if (leftover > 0 && leftover <= s.remaining()) {
      s.skip(leftover);
    }
  }

  return items;
}

/** Find the item ID for an Exif item. */
function findExifItemId(items: InfeItem[]): number | undefined {
  return items.find((it) => it.itemType === "Exif")?.itemId;
}

/** Find the item ID for an XMP (mime application/rdf+xml) item. */
function findXmpItemId(items: InfeItem[]): number | undefined {
  return items.find(
    (it) => it.itemType === "mime" && it.contentType === "application/rdf+xml"
  )?.itemId;
}

export interface HeicExifResult {
  /** ByteStream positioned at the TIFF header (after the Exif prefix). */
  tiffStream: ByteStream;
}

/** Find the meta box and parse iinf + iloc from it. Shared by Exif and XMP lookup. */
function parseMetaBox(stream: ByteStream):
  | {
      items: InfeItem[];
      ilocEntries: IlocEntry[];
    }
  | undefined {
  let metaData: ByteStream | undefined;

  walkBoxes(stream, (box, data) => {
    if (box.type === "meta") {
      if (data.size() > 4) {
        metaData = data.branch(4);
      }
      return true;
    }
  });

  if (!metaData) {
    return;
  }

  let items: InfeItem[] | undefined;
  let ilocEntries: IlocEntry[] | undefined;

  walkChildBoxes(metaData, (box, data) => {
    if (box.type === "iinf") {
      items = parseIinf(data);
    } else if (box.type === "iloc") {
      ilocEntries = parseIloc(data);
    }
  });

  if (!(items && ilocEntries)) {
    return;
  }

  return { items, ilocEntries };
}

/** Look up an item's raw bytes from iloc entries. */
function readItemBytes(
  stream: ByteStream,
  itemId: number,
  ilocEntries: IlocEntry[]
): ByteStream | undefined {
  const entry = ilocEntries.find((e) => e.itemId === itemId);
  if (!entry || entry.extents.length === 0) {
    return;
  }

  const ext = entry.extents[0];
  if (!ext) {
    return;
  }
  const absoluteOffset = entry.baseOffset + ext.offset;

  if (absoluteOffset + ext.length > stream.size()) {
    return;
  }

  return stream.branch(absoluteOffset, ext.length);
}

/**
 * Extract EXIF TIFF bytes from a HEIC/HEIF file.
 * Returns a ByteStream at the TIFF header, or undefined if no Exif item found.
 */
export function findHeicExif(stream: ByteStream): ByteStream | undefined {
  const meta = parseMetaBox(stream);
  if (!meta) {
    return;
  }

  const exifItemId = findExifItemId(meta.items);
  if (exifItemId === undefined) {
    return;
  }

  const exifPayload = readItemBytes(stream, exifItemId, meta.ilocEntries);
  if (!exifPayload) {
    return;
  }

  exifPayload.setEndian("BE");

  // The Exif payload has a 4-byte prefix: offset from start of payload to TIFF header
  const tiffOffset = exifPayload.u32();

  if (tiffOffset + 4 > exifPayload.size()) {
    return;
  }

  exifPayload.seek(tiffOffset);
  const remaining = exifPayload.size() - tiffOffset;

  return exifPayload.branch(exifPayload.tell(), remaining);
}

/**
 * Extract XMP XML string from a HEIC/HEIF file.
 * Returns the raw XML string, or undefined if no XMP item found.
 */
export function findHeicXmp(stream: ByteStream): string | undefined {
  const meta = parseMetaBox(stream);
  if (!meta) {
    return;
  }

  const xmpItemId = findXmpItemId(meta.items);
  if (xmpItemId === undefined) {
    return;
  }

  const xmpPayload = readItemBytes(stream, xmpItemId, meta.ilocEntries);
  if (!xmpPayload) {
    return;
  }

  return xmpPayload.readString(xmpPayload.size());
}

/**
 * Read image dimensions from HEIC ispe (image spatial extents) property.
 */
export function readHeicSize(stream: ByteStream): ImageSize | undefined {
  let metaData: ByteStream | undefined;

  walkBoxes(stream, (box, data) => {
    if (box.type === "meta") {
      if (data.size() > 4) {
        metaData = data.branch(4);
      }
      return true;
    }
  });

  if (!metaData) {
    return;
  }

  let result: ImageSize | undefined;

  walkChildBoxes(metaData, (box, data) => {
    if (box.type === "iprp") {
      walkChildBoxes(data, (innerBox, innerData) => {
        if (innerBox.type === "ipco") {
          walkChildBoxes(innerData, (propBox, propData) => {
            if (propBox.type === "ispe" && !result) {
              propData.setEndian("BE");
              propData.skip(4); // version + flags
              const width = propData.u32();
              const height = propData.u32();
              result = { width, height };
            }
          });
        }
      });
    }
  });

  return result;
}
