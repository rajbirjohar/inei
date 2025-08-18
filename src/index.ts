import { createParser } from './factory';
import type { ParserOptions } from './parser';

/**
 * @description
 * Parses EXIF data from the provided input.
 * @param {ArrayBuffer | Uint8Array | Buffer} input - The input data to parse as EXIF.
 * @param {ParserOptions} [opts] - Optional parser options.
 */
export function parseExif(
  input: ArrayBuffer | Uint8Array | Buffer,
  opts?: ParserOptions
) {
  const parser = createParser(input, opts);
  return parser.parse();
}

export type { ParserOptions } from './parser';
export type { ImageSize, ParsedExif, ThumbnailInfo } from './types';
