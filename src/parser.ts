import type { ByteStream } from "./byte-stream";
import { detectFormat } from "./detect";
import { readIFDs, readTiffIFDs } from "./exif-sections";
import { computeFormattedTags } from "./format-tags";
import { findHeicExif, findHeicXmp, readHeicSize } from "./heic";
import { isSOF, readSections, readSizeFromSOF } from "./jpeg";
import { applyExifOffsetTags } from "./offsets";
import { findExifChunk, readPngChunks, readPngSize } from "./png";
import {
  castDateValues,
  castDegreeValues,
  simplifyRationals,
} from "./simplify";
import { ExifTagNames, GPSTagNames } from "./tags";
import { TiffType } from "./tiff-types";
import {
  ExifError,
  ExifSectionKind,
  type ImageSize,
  type ParsedExif,
  type SimplifiedTagValue,
  type ThumbnailInfo,
  type XmpData,
} from "./types";
import { extractXmpFromApp1, extractXmpFromPngITxt, parseXmp } from "./xmp";

/**
 * @module parser
 * High-level EXIF parser that supports JPEG, PNG, and HEIC/HEIF/AVIF.
 *
 * - JPEG: Scans APP1 segments for EXIF, SOF for image size
 * - PNG: Reads eXIf chunk (raw TIFF), IHDR for image size
 * - HEIC: Navigates ISOBMFF boxes to find Exif item, ispe for image size
 *
 * All formats use the same TIFF/IFD parsing core.
 */

export interface ParserOptions {
  /**
   * Whether to hide internal pointer tags (ExifOffset, GPSInfo, thumbnail pointers).
   * This is useful for cleaner output but may omit some metadata.
   */
  hidePointers?: boolean;
  /**
   * Whether to extract image size from container format (JPEG SOF, PNG IHDR, HEIC ispe).
   */
  imageSize?: boolean;
  /**
   * Whether to include formatted tag values in the output.
   * This is useful for displaying human-readable strings for common tags.
   */
  includeFormatted?: boolean;
  /**
   * Whether to include UNDEFINED (binary) tags in the output.
   */
  readBinaryTags?: boolean;
  /**
   * Whether to resolve tag IDs to human-readable names.
   */
  resolveTagNames?: boolean;
  /**
   * Whether to return the tag map in the parsed result.
   * If false, only the parsed values will be returned.
   */
  returnTags?: boolean;
  /**
   * Whether to simplify rational values to floats and cast dates/GPS to numbers.
   */
  simplifyValues?: boolean;
}

const DEFAULTS: Required<ParserOptions> = {
  readBinaryTags: false,
  resolveTagNames: true,
  simplifyValues: true,
  imageSize: true,
  hidePointers: true,
  returnTags: true,
  includeFormatted: false,
};

const POINTER_TAGS = new Set<number>([
  0x8769, // ExifOffset
  0x8825, // GPSInfo
  0x0201, // ThumbnailOffset
  0x0202, // ThumbnailLength
  0x0103, // Compression / ThumbnailType
]);

function makeTagKey(section: ExifSectionKind, tagId: number): string {
  const table = section === ExifSectionKind.GPSIFD ? GPSTagNames : ExifTagNames;
  return table[tagId] ?? `tag_0x${tagId.toString(16)}`;
}

function maybeSimplify(
  value: SimplifiedTagValue,
  format: TiffType,
  simplify: boolean
): SimplifiedTagValue {
  if (!simplify) {
    return value;
  }
  if (format === TiffType.RATIONAL || format === TiffType.SRATIONAL) {
    return simplifyRationals(value, format, { zeroDenIsNull: true });
  }
  return value;
}

/**
 * @description
 * Main EXIF parser class that processes JPEG, PNG, or HEIC streams and extracts EXIF data.
 */
export class ExifParser {
  private readonly stream: ByteStream;
  private readonly opts: Required<ParserOptions>;

  constructor(stream: ByteStream, opts?: ParserOptions) {
    this.stream = stream;
    this.opts = { ...DEFAULTS, ...opts };
  }

  parse(): { ok: true; data: ParsedExif } | { ok: false; error: ExifError } {
    try {
      const format = detectFormat(this.stream);

      switch (format) {
        case "jpeg":
          return this.parseJpeg();
        case "png":
          return this.parsePng();
        case "heic":
          return this.parseHeic();
        default:
          return {
            ok: false,
            error: new ExifError("NOT_JPEG", "Unsupported image format"),
          };
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      return { ok: false, error: new ExifError("UNKNOWN", err.message) };
    }
  }

  /** Create the onTag callback that populates the tags record. */
  private makeTagHandler(tags: Record<string, SimplifiedTagValue>) {
    return (
      ifd: ExifSectionKind,
      tagId: number,
      value: unknown,
      format: TiffType
    ) => {
      if (!this.opts.readBinaryTags && format === TiffType.UNDEFINED) {
        return;
      }
      if (this.opts.hidePointers && POINTER_TAGS.has(tagId)) {
        return;
      }
      const key = makeTagKey(ifd, tagId);
      const out = maybeSimplify(
        value as SimplifiedTagValue,
        format,
        this.opts.simplifyValues
      );
      if (this.opts.returnTags && !(key in tags)) {
        tags[key] = out;
      }
    };
  }

  /** Post-process tags: GPS, dates, offsets, and build the result. */
  private finalize(
    tags: Record<string, SimplifiedTagValue>,
    image: ImageSize | undefined,
    thumbnail: ThumbnailInfo | undefined,
    xmp?: XmpData
  ): { ok: true; data: ParsedExif } {
    const get = (q: { name?: string }): SimplifiedTagValue | undefined =>
      q.name ? tags[q.name] : undefined;
    const set = (q: { name?: string }, v: SimplifiedTagValue): void => {
      if (q.name) {
        tags[q.name] = v;
      }
    };

    castDegreeValues(
      (q) => get(q),
      (q, v) => set(q, v)
    );
    castDateValues(
      (q) => get(q),
      (q, v) => set(q, v)
    );
    applyExifOffsetTags(tags);

    const data: ParsedExif = {
      image,
      thumbnail,
      tagsRaw: { ...tags },
      tags,
    };

    if (xmp !== undefined && Object.keys(xmp).length > 0) {
      data.xmp = xmp;
    }

    if (this.opts.includeFormatted) {
      const formatted = computeFormattedTags(tags);
      if (Object.keys(formatted).length) {
        data.formattedTags = formatted;
      }
    }

    return { ok: true, data };
  }

  private parseJpeg():
    | { ok: true; data: ParsedExif }
    | { ok: false; error: ExifError } {
    const tags: Record<string, SimplifiedTagValue> = {};
    const onTag = this.makeTagHandler(tags);
    let image: ImageSize | undefined;
    let thumbnail: ThumbnailInfo | undefined;
    let xmp: XmpData | undefined;

    const handleApp1 = (section: ByteStream) => {
      // Try XMP first (it also lives in APP1 but with a different prefix)
      if (!xmp) {
        const xmpXml = extractXmpFromApp1(section.branch(0));
        if (xmpXml) {
          xmp = parseXmp(xmpXml);
          return;
        }
      }

      const {
        ok,
        tiffBase,
        thumbnail: thumb,
      } = readIFDs(section.branch(0), onTag);

      if (ok && thumb) {
        const app1Abs = section.baseOffset();
        const absoluteOffset = app1Abs + tiffBase + thumb.offsetFromTiff;
        thumbnail = {
          type: thumb.type,
          offsetFromTiff: thumb.offsetFromTiff,
          length: thumb.length,
          absoluteOffset,
        };
      }
    };

    readSections(this.stream.branch(0), (marker, section) => {
      if (marker === 0xe1) {
        handleApp1(section);
      } else if (this.opts.imageSize && isSOF(marker)) {
        image = readSizeFromSOF(section);
      }
    });

    return this.finalize(tags, image, thumbnail, xmp);
  }

  private parsePng():
    | { ok: true; data: ParsedExif }
    | { ok: false; error: ExifError } {
    const tags: Record<string, SimplifiedTagValue> = {};
    const onTag = this.makeTagHandler(tags);
    let thumbnail: ThumbnailInfo | undefined;
    let xmp: XmpData | undefined;

    const tiffStream = findExifChunk(this.stream);
    if (tiffStream) {
      const result = readTiffIFDs(tiffStream.branch(0), onTag);
      if (result.ok && result.thumbnail) {
        thumbnail = {
          type: result.thumbnail.type,
          offsetFromTiff: result.thumbnail.offsetFromTiff,
          length: result.thumbnail.length,
        };
      }
    }

    // Look for XMP in iTXt chunks
    readPngChunks(this.stream, (type, data) => {
      if (type === "iTXt" && !xmp) {
        const xmpXml = extractXmpFromPngITxt(data);
        if (xmpXml) {
          xmp = parseXmp(xmpXml);
        }
      }
    });

    const image = this.opts.imageSize ? readPngSize(this.stream) : undefined;

    return this.finalize(tags, image, thumbnail, xmp);
  }

  private parseHeic():
    | { ok: true; data: ParsedExif }
    | { ok: false; error: ExifError } {
    const tags: Record<string, SimplifiedTagValue> = {};
    const onTag = this.makeTagHandler(tags);
    let thumbnail: ThumbnailInfo | undefined;

    const tiffStream = findHeicExif(this.stream);
    if (tiffStream) {
      const result = readTiffIFDs(tiffStream.branch(0), onTag);
      if (result.ok && result.thumbnail) {
        thumbnail = {
          type: result.thumbnail.type,
          offsetFromTiff: result.thumbnail.offsetFromTiff,
          length: result.thumbnail.length,
        };
      }
    }

    const image = this.opts.imageSize ? readHeicSize(this.stream) : undefined;

    // Extract XMP from HEIC
    let xmp: XmpData | undefined;
    const xmpXml = findHeicXmp(this.stream);
    if (xmpXml) {
      xmp = parseXmp(xmpXml);
    }

    return this.finalize(tags, image, thumbnail, xmp);
  }
}
