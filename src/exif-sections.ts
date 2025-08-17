import { ByteStream } from './byte-stream';
import { TiffType } from './tiff-types';
import {
  ExifSectionKind,
  type RawTagValue,
  type ReadValueInlineReturn,
  type ReadValuesByTypeReturn,
  type ThumbnailInfo,
  ThumbnailType,
} from './types';

/**
 * @module exif-sections
 * EXIF/TIFF reader for APP1 payloads. Emits tags by traversing IFDs.
 *
 * Flow:
 *   APP1 payload -> "Exif\0\0" -> TIFF header (endianness + magic)
 *   -> IFD0 -> (ExifOffset -> SubIFD), (GPSInfo -> GPSIFD), (IFD1 for thumbnail)
 *
 * Value extraction rules:
 * - Compute total bytes as `TYPE_SIZE[type] * count`.
 * - If <= 4, value is inlined in entry; reconstruct a tiny ByteStream with TIFF endianness.
 * - If > 4, the entry stores an offset from TIFF base; branch and read from there.
 *
 * Emits:
 * - Each tag via (section, tagId, value, format)
 * - Optional thumbnail info (type, offsetFromTiff, length)
 */

/**
 * @description
 * Mapping of TIFF data types to their byte sizes.
 */
const TYPE_SIZES: Record<TiffType, number> = {
  [TiffType.BYTE]: 1,
  [TiffType.ASCII]: 1,
  [TiffType.SHORT]: 2,
  [TiffType.LONG]: 4,
  [TiffType.RATIONAL]: 8,
  [TiffType.UNDEFINED]: 1,
  [TiffType.SLONG]: 4,
  [TiffType.SRATIONAL]: 8,
};

type NonUndef<T> = T extends undefined ? never : T;

export type OnTag = (
  section: ExifSectionKind,
  tagId: number,
  value: NonUndef<RawTagValue>,
  format: TiffType
) => void;

/**
 * @description
 * Result type for reading IFDs from an APP1 payload.
 */
export type ReadIFDsResult = {
  ok: boolean;
  /** offset within the APP1 payload where TIFF header starts (i.e., 6) */
  tiffBase: number;
  thumbnail?: ThumbnailInfo & { compression?: number };
};

// Pointer tags
const TAG_EXIF_OFFSET = 0x8769;
const TAG_GPS_INFO = 0x8825;

// IFD1 (thumbnail) tags
const TAG_THUMB_OFFSET = 0x0201;
const TAG_THUMB_LENGTH = 0x0202;
const TAG_COMPRESSION = 0x0103; // 6=JPEG, 1=TIFF

const TIFF_MAGIC = 0x002a;

function okNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

/** Read "Exif\0\0" and return a TIFF stream positioned right after. */
function openTiffFromApp1(
  app1: ByteStream
):
  | { ok: true; tiff: ByteStream; tiffBase: number }
  | { ok: false; tiffBase: number } {
  const sig = app1.readString(4);
  const nul = app1.readString(2);
  const tiffBase = app1.tell();
  if (sig !== 'Exif' || nul !== '\u0000\u0000') {
    return { ok: false, tiffBase };
  }
  return { ok: true, tiff: app1.branch(tiffBase), tiffBase };
}

/** Read BOM and set endianness on the TIFF stream. */
function configureEndian(tiff: ByteStream): boolean {
  const b0 = tiff.u8();
  const b1 = tiff.u8();
  if (b0 === 0x49 && b1 === 0x49) {
    tiff.setEndian('LE');
    return true;
  }
  if (b0 === 0x4d && b1 === 0x4d) {
    tiff.setEndian('BE');
    return true;
  }
  return false;
}

/** Validate TIFF magic and return IFD0 stream. */
function openIFD0(tiff: ByteStream): ByteStream | undefined {
  const magic = tiff.u16();
  if (magic !== TIFF_MAGIC) {
    return;
  }
  const firstIFDOffset = tiff.u32();
  return tiff.branch(firstIFDOffset);
}

/** Read an IFD at offset if present. */
function readIfdAt(
  tiff: ByteStream,
  offset: number | undefined,
  section: ExifSectionKind,
  onTag: OnTag
): void {
  if (!okNumber(offset)) {
    return;
  }
  const dir = tiff.branch(offset);
  readIFD({ tiff, dir, section, onTag });
}

/** Collect thumbnail info from IFD1; returns undefined if incomplete. */
function readThumbnailFromIFD1(
  tiff: ByteStream,
  ifd1Offset: number | undefined,
  onTag: OnTag
): ReadIFDsResult['thumbnail'] | undefined {
  if (!okNumber(ifd1Offset)) {
    return;
  }

  const dir = tiff.branch(ifd1Offset);
  let thumbOffset: number | undefined;
  let thumbLength: number | undefined;
  let compression: number | undefined;

  readIFD({
    tiff,
    dir,
    section: ExifSectionKind.IFD1,
    onTag: (sec, tagId, value, fmt) => {
      // forward to caller
      onTag(sec, tagId, value, fmt);
      // collect thumbnail fields
      if (tagId === TAG_THUMB_OFFSET && typeof value === 'number') {
        thumbOffset = value;
      } else if (tagId === TAG_THUMB_LENGTH && typeof value === 'number') {
        thumbLength = value;
      } else if (tagId === TAG_COMPRESSION && typeof value === 'number') {
        compression = value;
      }
    },
  });

  if (okNumber(thumbOffset) && okNumber(thumbLength)) {
    return {
      type: compression === 6 ? ThumbnailType.JPEG : ThumbnailType.TIFF,
      offsetFromTiff: thumbOffset,
      length: thumbLength,
      compression,
    };
  }
  return;
}

/**
 * @description
 * Given an APP1 payload stream (beginning at segment data, i.e. after length),
 * parse the EXIF TIFF and emit tags via callback.
 * @param {ByteStream} app1 - The ByteStream containing the APP1 payload.
 * @param {OnTag} onTag - Callback to emit tags found in the IFDs.
 * @return {ReadIFDsResult} - Result containing success status, TIFF base offset, and optional thumbnail info.
 */
export function readIFDs(app1: ByteStream, onTag: OnTag): ReadIFDsResult {
  // 1) Validate APP1/Exif header and open TIFF
  const open = openTiffFromApp1(app1);
  if (!open.ok) {
    return { ok: false, tiffBase: open.tiffBase };
  }
  const { tiff, tiffBase } = open;

  // 2) Endianness + IFD0
  if (!configureEndian(tiff)) {
    return { ok: false, tiffBase };
  }
  const ifd0 = openIFD0(tiff);
  if (!ifd0) {
    return { ok: false, tiffBase };
  }

  // 3) Read IFD0, collect pointer offsets + IFD1 offset
  let exifIFDOffset: number | undefined;
  let gpsIFDOffset: number | undefined;
  const ifd1Offset = readIFD({
    tiff,
    dir: ifd0,
    section: ExifSectionKind.IFD0,
    onTag,
    onPointer: (tagId, value) => {
      if (tagId === TAG_EXIF_OFFSET && typeof value === 'number') {
        exifIFDOffset = value;
      } else if (tagId === TAG_GPS_INFO && typeof value === 'number') {
        gpsIFDOffset = value;
      }
    },
  });

  // 4) SubIFD (Exif) and GPS IFD (optional)
  readIfdAt(tiff, exifIFDOffset, ExifSectionKind.SubIFD, onTag);
  readIfdAt(tiff, gpsIFDOffset, ExifSectionKind.GPSIFD, onTag);

  // 5) IFD1 (thumbnail)
  const thumbnail = readThumbnailFromIFD1(tiff, ifd1Offset, onTag);

  return { ok: true, tiffBase, thumbnail };
}

/**
 * @description
 * Reads one IFD at current position of `dir` (a branch stream).
 * Returns the offset to the next IFD (or 0 if none).
 * @param {ByteStream} tiff - The ByteStream containing the TIFF data.
 * @param {ByteStream} dir - The ByteStream for the IFD directory.
 * @param {ExifSectionKind} section - The section kind of the IFD.
 * @param {OnTag} onTag - Callback to emit tags found in the IFD.
 * @param {function} [onPointer] - Optional callback for pointer tags (ExifOffset, GPSInfo).
 * @param {number} [onPointer.tagId] - The tag ID of the pointer tag.
 * @param {number} [onPointer.value] - The value of the pointer tag (offset).
 * @return {number} - The offset to the next IFD, or 0 if none.
 */
function readIFD({
  tiff,
  dir,
  section,
  onTag,
  onPointer,
}: {
  tiff: ByteStream;
  dir: ByteStream;
  section: ExifSectionKind;
  onTag: OnTag;
  onPointer?: (tagId: number, value: number) => void;
}): number {
  const numEntries = dir.u16();
  for (let i = 0; i < numEntries; i++) {
    const tagId = dir.u16();
    const type = dir.u16() as TiffType;
    const count = dir.u32();

    const valueOrOffset = dir.u32();
    const totalBytes = (TYPE_SIZES[type] ?? 0) * count;

    let value: ReadValueInlineReturn | ReadValuesByTypeReturn;

    if (totalBytes <= 4) {
      const inline = new Uint8Array(4);
      new DataView(inline.buffer, inline.byteOffset, 4).setUint32(
        0,
        valueOrOffset || 0, // ensure 32-bit integer
        tiff.endianness() === 'LE'
      );
      value = readValueInline(
        new ByteStream(inline, tiff.endianness()),
        type,
        count
      );
    } else {
      const valStream = tiff.branch(valueOrOffset);

      value = readValueByType(valStream, type, count);
    }

    // Skip entries we don't know how to represent
    if (value === undefined) {
      continue;
    }

    // Special-case pointers (we know "value" is defined here)
    if (
      onPointer &&
      typeof value === 'number' &&
      (tagId === 0x87_69 || tagId === 0x88_25)
    ) {
      onPointer(tagId, value);
    }

    if (value === undefined) {
      continue;
    }

    onTag(section, tagId, value, type);
  }

  const nextIFDOffset = dir.u32();
  return nextIFDOffset;
}

/**
 * @description
 * Reads a value from the inline bytes or by offset, depending on the type and count.
 * Returns the parsed value based on TIFF data type.
 * @param {ByteStream} s - The ByteStream to read from.
 * @param {TiffType} type - The TIFF data type of the value.
 * @param {number} count - The number of items of this type.
 * @return {ReadValueInlineReturn} - The parsed value, which can be a single value or an array.
 */
export function readValueInline(
  s: ByteStream,
  type: TiffType,
  count: number
): ReadValueInlineReturn {
  // For inline, only small counts make sense.
  switch (type) {
    case TiffType.BYTE: {
      if (count === 1) {
        return s.u8();
      }
      const arr: number[] = [];
      for (let i = 0; i < count; i++) {
        arr.push(s.u8());
      }
      return arr;
    }
    case TiffType.SHORT: {
      if (count === 1) {
        return s.u16();
      }
      const arr: number[] = [];
      for (let i = 0; i < count; i++) {
        arr.push(s.u16());
      }
      return arr;
    }
    case TiffType.ASCII: {
      const text = s.readString(count);
      // biome-ignore lint/performance/useTopLevelRegex: This is a small string operation.
      return text.replace(/\0+$/, '');
    }
    case TiffType.LONG: {
      if (count === 1) {
        return s.u32();
      }
      const arr: number[] = [];
      for (let i = 0; i < count; i++) {
        arr.push(s.u32());
      }
      return arr;
    }
    default:
      return;
  }
}

type ReaderReturn =
  | string
  | number
  | number[]
  | [number, number]
  | [number, number][]
  | Uint8Array
  | undefined;

type Reader = (s: ByteStream, count: number) => ReaderReturn;

// Hoisted for lint/perf: strip trailing NULs from ASCII
const TRAILING_NULS = /\0+$/;

/** Read one or many numeric values with a provided "read one" fn. */
function readOneOrManyNumber(
  _s: ByteStream,
  count: number,
  readOne: () => number
): number | number[] {
  if (count === 1) {
    return readOne();
  }
  const out = new Array<number>(count);
  for (let i = 0; i < count; i++) {
    out[i] = readOne();
  }
  return out;
}

/** Read one or many rational pairs [num, den] with a provided "read number" fn. */
function readOneOrManyPair(
  _s: ByteStream,
  count: number,
  readNum: () => number
): [number, number] | [number, number][] {
  if (count === 1) {
    return [readNum(), readNum()];
  }
  const out = new Array<[number, number]>(count);
  for (let i = 0; i < count; i++) {
    out[i] = [readNum(), readNum()];
  }
  return out;
}

/**
 * Table-driven readers for each TIFF type.
 * Using `satisfies` ensures we cover every TiffType at compile time.
 */
const READERS = {
  [TiffType.BYTE]: (s, count) =>
    count === 1 ? s.u8() : Array.from(s.slice(count)),

  [TiffType.ASCII]: (s, count) =>
    s.readString(count).replace(TRAILING_NULS, ''),

  [TiffType.SHORT]: (s, count) => readOneOrManyNumber(s, count, () => s.u16()),

  [TiffType.LONG]: (s, count) => readOneOrManyNumber(s, count, () => s.u32()),

  [TiffType.RATIONAL]: (s, count) => readOneOrManyPair(s, count, () => s.u32()),

  [TiffType.UNDEFINED]: (s, count) => s.slice(count),

  [TiffType.SLONG]: (s, count) => readOneOrManyNumber(s, count, () => s.i32()),

  [TiffType.SRATIONAL]: (s, count) =>
    readOneOrManyPair(s, count, () => s.i32()),
} satisfies Record<(typeof TiffType)[keyof typeof TiffType], Reader>;

/**
 * @description
 * Reads a value from the ByteStream based on the TIFF data type and count.
 * Returns the parsed value, which can be a single value or an array.
 * @param {ByteStream} s - The ByteStream to read from.
 * @param {TiffType} type - The TIFF data type of the value.
 * @param {number} count - The number of items of this type.
 * @return {ReadValuesByTypeReturn} - The parsed value, which can be a single value or an array.
 */
export function readValueByType(
  s: ByteStream,
  type: (typeof TiffType)[keyof typeof TiffType],
  count: number
): ReaderReturn {
  const reader = READERS[type];
  return reader ? reader(s, count) : undefined;
}
