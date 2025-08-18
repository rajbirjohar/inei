import type { ByteStream } from './byte-stream';
import { readIFDs } from './exif-sections';
import { isSOF, readSections, readSizeFromSOF } from './jpeg';
import { applyExifOffsetTags } from './offsets';
import {
  castDateValues,
  castDegreeValues,
  simplifyRationals,
} from './simplify';
import { ExifTagNames, GPSTagNames } from './tags';
import { TiffType } from './tiff-types';
import {
  ExifError,
  ExifSectionKind,
  type ImageSize,
  type ParsedExif,
  type SimplifiedTagValue,
  type ThumbnailInfo,
} from './types';

/**
 * @module parser
 * High-level EXIF parser that:
 * - Scans JPEG headers for APP1 and SOF, extracting size and EXIF payloads
 * - Emits tags via exif-sections, resolves names via tags.ts
 * - Optionally simplifies values (rationals, dates, GPS)
 * - Returns a typed ParsedExif result with image size, thumbnail info, and tag maps
 *
 * Options:
 * - readBinaryTags: include UNDEFINED (binary) values
 * - resolveTagNames: map numeric tag IDs to friendly names
 * - simplifyValues: turn rationals to floats, dates/GPS to numbers
 * - imageSize: extract JPEG SOF width/height
 * - hidePointers: omit internal pointer tags (ExifOffset/GPSInfo/thumbnail pointers)
 * - returnTags: include the tag map in the result
 */

export type ParserOptions = {
  /**
   * Whether to include UNDEFINED (binary) tags in the output.
   */
  readBinaryTags?: boolean;
  /**
   * Whether to resolve tag IDs to human-readable names.
   */
  resolveTagNames?: boolean;
  /**
   * Whether to simplify rational values to floats and cast dates/GPS to numbers.
   */
  simplifyValues?: boolean;
  /**
   * Whether to extract image size from JPEG SOF segments.
   */
  imageSize?: boolean;
  /**
   * Whether to hide internal pointer tags (ExifOffset, GPSInfo, thumbnail pointers).
   * This is useful for cleaner output but may omit some metadata.
   */
  hidePointers?: boolean;
  /**
   * Whether to return the tag map in the parsed result.
   * If false, only the parsed values will be returned.
   */
  returnTags?: boolean;
};

const DEFAULTS: Required<ParserOptions> = {
  readBinaryTags: false,
  resolveTagNames: true,
  simplifyValues: true,
  imageSize: true,
  hidePointers: true,
  returnTags: true,
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
 * Main EXIF parser class that processes a JPEG stream and extracts EXIF data.
 */
export class ExifParser {
  private readonly stream: ByteStream;
  private readonly opts: Required<ParserOptions>;

  /**
   * @param stream - Root ByteStream with the input file.
   * @param opts - Optional parser controls (see module docs).
   */
  constructor(stream: ByteStream, opts?: ParserOptions) {
    this.stream = stream;
    this.opts = { ...DEFAULTS, ...opts };
  }

  /**
   * Parses the EXIF data from the JPEG stream.
   * @returns {ParsedExif} An object containing parsed EXIF data, image size, and thumbnail info.
   */
  parse(): { ok: true; data: ParsedExif } | { ok: false; error: ExifError } {
    try {
      const tags: Record<string, SimplifiedTagValue> = {};
      let image: ImageSize | undefined;
      let thumbnail: ThumbnailInfo | undefined;

      readSections(this.stream.branch(0), (marker, section) => {
        const APP1 = 0xe1; // APP1 marker for EXIF data
        if (marker === APP1) {
          const {
            ok,
            tiffBase,
            thumbnail: thumb,
          } = readIFDs(section.branch(0), (ifd, tagId, value, format) => {
            // Skip binary blobs unless opted in
            if (!this.opts.readBinaryTags && format === TiffType.UNDEFINED) {
              return;
            }

            // Optionally hide pointer-ish tags
            if (this.opts.hidePointers && POINTER_TAGS.has(tagId)) {
              return;
            }

            // Compute final key and value
            const key = makeTagKey(ifd, tagId);
            const out = maybeSimplify(
              value as SimplifiedTagValue,
              format,
              this.opts.simplifyValues
            );

            if (this.opts.returnTags && !(key in tags)) {
              tags[key] = out;
            }
          });

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
        } else if (this.opts.imageSize && isSOF(marker)) {
          image = readSizeFromSOF(section);
        }
      });

      // Post-processing: cast GPS + date values on the tag map
      {
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
      }

      const data: ParsedExif = {
        image,
        thumbnail,
        tagsRaw: { ...tags },
        tags, // narrowed to Partial<ExifTagMap> by consumer
      };

      return { ok: true, data };
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      return { ok: false, error: new ExifError('UNKNOWN', err.message) };
    }
  }
}
