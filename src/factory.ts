import { ByteStream } from "./byte-stream";
import { ExifParser, type ParserOptions } from "./parser";

/**
 * @description
 * Factory function to create an instance of ExifParser.
 * @param {ArrayBuffer | Uint8Array | Buffer} input - The input data to parse as EXIF.
 * @param {ParserOptions} [opts] - Optional parser options.
 * @returns {ExifParser} An instance of ExifParser initialized with the input data.
 */
export function createParser(
	input: ArrayBuffer | Uint8Array | Buffer,
	opts?: ParserOptions,
): ExifParser {
	const stream = ByteStream.from(input, "LE");
	return new ExifParser(stream, opts);
}
