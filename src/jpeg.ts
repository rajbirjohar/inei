import type { ByteStream } from "./byte-stream";
import type { ImageSize } from "./types";

/**
 * @module jpeg
 * JPEG header walker. Visits segments (APPn, SOFn, etc.) without decoding image data.
 *
 * Responsibilities:
 * - Validate SOI (0xFFD8) and iterate markers.
 * - For each segment with a length, expose its payload as a ByteStream window.
 * - Identify SOF segments and extract width/height.
 * - Identify APP1 segments so EXIF can be parsed downstream.
 *
 * Note: Segment lengths are big-endian (two bytes, includes the length itself).
 */

/**
 * @description
 * Function type for visiting JPEG sections.
 */
export type SectionVisitor = (marker: number, section: ByteStream) => void;

/** JPEG markers */
const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;

/**
 * @description
 * Set of Start of Frame (SOF) markers in JPEG.
 */
const SOF_MARKERS = new Set<number>([
	0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

/**
 * @description
 * Check if a marker is a Start of Frame (SOF) marker.
 * @param {number} marker - The JPEG marker to check.
 * @returns {boolean} True if the marker is a SOF marker, false otherwise.
 */
export function isSOF(marker: number): boolean {
	return SOF_MARKERS.has(marker);
}

/**
 * @description
 * Read JPEG sections and visit them with the provided visitor function.
 * This function iterates through the JPEG segments, starting from the
 * Start of Image (SOI) marker, and calls the visitor
 * function for each section found.
 * @param {ByteStream} stream - The ByteStream to read from.
 * @param {SectionVisitor} visitor - The function to call for each section.
 */
export function readSections(
	stream: ByteStream,
	visitor: SectionVisitor,
): void {
	// Verify SOI
	if (stream.u8() !== 0xff || stream.u8() !== SOI) {
		throw new Error("Not a JPEG (missing SOI)");
	}

	for (;;) {
		// Find next marker
		let b = stream.u8();
		while (b !== 0xff) b = stream.u8();
		const marker = stream.u8();

		if (marker === EOI) break;
		if (marker === SOS) break; // stop visiting at start of scan

		// Standalone markers (no length)
		// RSTn
		if (marker >= 0xd0 && marker <= 0xd7) {
			continue;
		}
		// TEM
		if (marker === 0x01) {
			continue;
		}

		// Segment length is big-endian 2 bytes, includes the length itself
		const lenMsb = stream.u8();
		const lenLsb = stream.u8();
		const len = (lenMsb << 8) | lenLsb;
		const payloadLen = len - 2;
		if (payloadLen < 0 || payloadLen > stream.remaining()) {
			throw new Error("Corrupt JPEG segment length");
		}

		const section = stream.branch(stream.tell(), payloadLen);
		stream.skip(payloadLen);

		visitor(marker, section);
	}
}

/**
 * @description
 * Read image size from a Start of Frame (SOF) section.
 * @param {ByteStream} section - The ByteStream containing the SOF section.
 * @returns {ImageSize} An object containing the width and height of the image.
 */
export function readSizeFromSOF(section: ByteStream): ImageSize {
	const s = section.branch(0);
	s.setEndian("BE");
	const _precision = s.u8();
	const height = s.u16();
	const width = s.u16();
	return { width, height };
}
