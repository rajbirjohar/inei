import { ByteStream } from "./byte-stream";
import type { ParsedExif } from "./types";

/**
 * Extract thumbnail bytes if available (returns a copy).
 * Works in Node and browsers.
 */
export function extractThumbnail(
	input: ArrayBuffer | Uint8Array | Buffer,
	exif: ParsedExif,
): Uint8Array | undefined {
	const t = exif.thumbnail;
	if (!t || t.absoluteOffset == null || t.length <= 0) return undefined;
	const s = ByteStream.from(input, "LE");
	const view = s.branch(t.absoluteOffset, t.length);
	return view.slice(t.length);
}
