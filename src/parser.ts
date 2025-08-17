import type { ByteStream } from "./byte-stream";
import { readIFDs, TiffType } from "./exif-sections";
import { isSOF, readSections, readSizeFromSOF } from "./jpeg";
import { applyExifOffsetTags } from "./offsets";
import {
	castDateValues,
	castDegreeValues,
	simplifyRationals,
} from "./simplify";
import { ExifTagNames, GPSTagNames } from "./tags";
import {
	ExifError,
	ExifSectionKind,
	type ImageSize,
	type ParsedExif,
	type SimplifiedTagValue,
	type ThumbnailInfo,
} from "./types";

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

export interface ParserOptions {
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
}

const DEFAULTS: Required<ParserOptions> = {
	readBinaryTags: false,
	resolveTagNames: true,
	simplifyValues: true,
	imageSize: true,
	hidePointers: true,
	returnTags: true,
};

/**
 * @description
 * Main EXIF parser class that processes a JPEG stream and extracts EXIF data.
 */
export class ExifParser {
	private readonly opts: Required<ParserOptions>;

	/**
	 * @param stream - Root ByteStream with the input file.
	 * @param opts - Optional parser controls (see module docs).
	 */
	constructor(
		private readonly stream: ByteStream,
		opts?: ParserOptions,
	) {
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
				if (marker === 0xe1 /* APP1 */) {
					const {
						ok,
						tiffBase,
						thumbnail: thumb,
					} = readIFDs(section.branch(0), (ifd, tagId, value, format) => {
						// Ignore UNDEFINED binary blobs unless opted-in
						if (!this.opts.readBinaryTags && format === TiffType.UNDEFINED) {
							return;
						}

						const isPointer =
							tagId === 0x8769 ||
							tagId === 0x8825 ||
							tagId === 0x0201 ||
							tagId === 0x0202 ||
							tagId === 0x0103;
						if (this.opts.hidePointers && isPointer) {
							return;
						}

						let key: string;
						if (ifd === ExifSectionKind.GPSIFD) {
							key = GPSTagNames[tagId] ?? `tag_0x${tagId.toString(16)}`;
						} else {
							key = ExifTagNames[tagId] ?? `tag_0x${tagId.toString(16)}`;
						}

						let out: SimplifiedTagValue = value as SimplifiedTagValue;

						if (
							this.opts.simplifyValues &&
							(format === TiffType.RATIONAL || format === TiffType.SRATIONAL)
						) {
							// `format` is narrowed here, so the overload matches
							out = simplifyRationals(value, format, { zeroDenIsNull: true });
						}

						if (this.opts.returnTags) {
							if (!(key in tags)) {
								tags[key] = out;
							}
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
					if (q.name) tags[q.name] = v;
				};

				castDegreeValues(
					(q) => get(q),
					(q, v) => set(q, v),
				);
				castDateValues(
					(q) => get(q),
					(q, v) => set(q, v),
				);
				applyExifOffsetTags(tags);
			}

			const data: ParsedExif = {
				image,
				thumbnail,
				tagsRaw: { ...tags },
				tags: tags, // narrowed to Partial<ExifTagMap> by consumer
			};

			return { ok: true, data };
		} catch (e) {
			const err = e instanceof Error ? e : new Error(String(e));
			return { ok: false, error: new ExifError("UNKNOWN", err.message) };
		}
	}
}
