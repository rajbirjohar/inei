import { createParser } from "./factory";
import type { ParserOptions } from "./parser";
import { extractThumbnail } from "./thumbnail";

type SyncInput = ArrayBuffer | Uint8Array | Buffer;
type AsyncInput = SyncInput | Blob | File;

/**
 * @description
 * Parses EXIF data from the provided input.
 * Supports JPEG, PNG, and HEIC/HEIF/AVIF formats.
 * @param {ArrayBuffer | Uint8Array | Buffer} input - The input data to parse.
 * @param {ParserOptions} [opts] - Optional parser options.
 */
export function parseExif(input: SyncInput, opts?: ParserOptions) {
  const parser = createParser(input, opts);
  return parser.parse();
}

/**
 * @description
 * Async version of parseExif that accepts Blob/File inputs (browser-friendly).
 * Also accepts ArrayBuffer/Uint8Array/Buffer for convenience.
 * @param {ArrayBuffer | Uint8Array | Buffer | Blob | File} input - The input data to parse.
 * @param {ParserOptions} [opts] - Optional parser options.
 */
export async function parseExifFromBlob(
  input: AsyncInput,
  opts?: ParserOptions
) {
  let buffer: SyncInput;
  if (input instanceof Blob) {
    buffer = await input.arrayBuffer();
  } else {
    buffer = input;
  }
  return parseExif(buffer, opts);
}

/**
 * @description
 * Convenience: extract GPS coordinates as decimal degrees.
 * Returns undefined if EXIF or GPS data is not available.
 * @param {ArrayBuffer | Uint8Array | Buffer} input - The input data.
 */
export function gps(
  input: SyncInput
): { latitude: number; longitude: number } | undefined {
  const result = parseExif(input, {
    simplifyValues: true,
    imageSize: false,
    hidePointers: true,
    returnTags: true,
    includeFormatted: false,
  });
  if (!result.ok) {
    return;
  }
  const { tags } = result.data;
  if (
    typeof tags.GPSLatitude === "number" &&
    typeof tags.GPSLongitude === "number"
  ) {
    return { latitude: tags.GPSLatitude, longitude: tags.GPSLongitude };
  }
  return;
}

/**
 * @description
 * Convenience: extract EXIF orientation value.
 * Returns undefined if EXIF or orientation is not available.
 * @param {ArrayBuffer | Uint8Array | Buffer} input - The input data.
 */
export function orientation(input: SyncInput): number | undefined {
  const result = parseExif(input, {
    simplifyValues: true,
    imageSize: false,
    hidePointers: true,
    returnTags: true,
    includeFormatted: false,
  });
  if (!result.ok) {
    return;
  }
  return typeof result.data.tags.Orientation === "number"
    ? result.data.tags.Orientation
    : undefined;
}

/**
 * @description
 * Convenience: extract embedded thumbnail as Uint8Array.
 * Returns undefined if no thumbnail is available.
 * @param {ArrayBuffer | Uint8Array | Buffer} input - The input data.
 */
export function thumbnail(input: SyncInput): Uint8Array | undefined {
  const result = parseExif(input);
  if (!result.ok) {
    return;
  }
  return extractThumbnail(input, result.data);
}

/**
 * @description
 * Convenience: extract embedded thumbnail as a blob: URL (browser only).
 * Returns undefined if no thumbnail is available or not in a browser.
 * @param {ArrayBuffer | Uint8Array | Buffer} input - The input data.
 */
export function thumbnailUrl(input: SyncInput): string | undefined {
  const bytes = thumbnail(input);
  if (!bytes) {
    return;
  }
  if (typeof Blob === "undefined" || typeof URL === "undefined") {
    return;
  }
  const blob = new Blob([bytes as BlobPart], { type: "image/jpeg" });
  return URL.createObjectURL(blob);
}

export type { ParserOptions } from "./parser";
// biome-ignore lint/performance/noBarrelFile: Library entry point — re-exports are intentional.
export { extractThumbnail } from "./thumbnail";
export type {
  ExifTagMap,
  ImageSize,
  ParsedExif,
  ThumbnailInfo,
  XmpData,
} from "./types";
export { ExifError } from "./types";
