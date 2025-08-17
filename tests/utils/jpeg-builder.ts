// tests/utils/jpeg-builder.ts
// Tiny helpers to synthesize a JPEG with APP1 (Exif) and a SOF0 section for width/height.
// Everything is written in a clear, step-by-step style (no assignments inside expressions).

type U8 = Uint8Array;

function be16(n: number): U8 {
	return new Uint8Array([(n >> 8) & 0xff, n & 0xff]);
}
function le16(n: number): U8 {
	return new Uint8Array([n & 0xff, (n >> 8) & 0xff]);
}
function le32(n: number): U8 {
	return new Uint8Array([
		n & 0xff,
		(n >> 8) & 0xff,
		(n >> 16) & 0xff,
		(n >> 24) & 0xff,
	]);
}
function ascii(s: string): U8 {
	return new TextEncoder().encode(s);
}
function withNull(u8: U8): U8 {
	const out = new Uint8Array(u8.length + 1);
	out.set(u8, 0);
	out[out.length - 1] = 0;
	return out;
}
function concat(...parts: U8[]): U8 {
	const len = parts.reduce((a, b) => a + b.length, 0);
	const out = new Uint8Array(len);
	let o = 0;
	for (const p of parts) {
		out.set(p, o);
		o += p.length;
	}
	return out;
}
function inline4(u: U8): U8 {
	const out = new Uint8Array(4);
	out.set(u.subarray(0, 4));
	return out;
}

/**
 * Build a minimal TIFF (little-endian) with IFD0 entries:
 * - Make (ASCII)
 * - Model (ASCII)
 * - XResolution (RATIONAL)
 * - YResolution (RATIONAL)
 *
 * The result is an APP1 Exif payload (starts with "Exif\0\0" then TIFF bytes).
 */
export function buildTiffLE_IFD0(opts?: {
	make?: string;
	model?: string;
	xres?: [number, number];
	yres?: [number, number];
}): U8 {
	const makeBytes = withNull(ascii(opts?.make ?? "TestCam"));
	const modelBytes = withNull(ascii(opts?.model ?? "ModelX"));
	const xres = opts?.xres ?? [240, 1];
	const yres = opts?.yres ?? [240, 1];

	// TIFF header: "II" (LE), magic 42, offset to IFD0 = 8
	const tiffHeader = concat(ascii("II"), le16(42), le32(8));

	const entries: U8[] = [];
	const dataArea: U8[] = [];

	// Data area starts after: header (8) + numEntries(2) + entries(4 * 12) + nextIFD(4)
	let dataOff = 8 + 2 + 4 * 12 + 4;

	// Helper to push a full 12-byte IFD entry
	function pushEntry(
		tag: number,
		type: number,
		count: number,
		valueOrOffset: U8,
	) {
		const entry = concat(le16(tag), le16(type), le32(count), valueOrOffset);
		entries.push(entry);
	}

	// ASCII tag writer (type=2). Inline if <= 4 bytes; otherwise store in data area.
	function writeAsciiTag(tag: number, bytes: U8) {
		const type = 2;
		const count = bytes.length;

		if (count <= 4) {
			const val = inline4(bytes);
			pushEntry(tag, type, count, val);
			return;
		}

		const start = dataOff;
		const offset = le32(start);
		pushEntry(tag, type, count, offset);

		dataArea.push(bytes);
		dataOff = dataOff + bytes.length;
	}

	// RATIONAL tag writer (type=5), count=1
	function writeRationalTag(tag: number, num: number, den: number) {
		const type = 5;
		const count = 1;

		const start = dataOff;
		const offset = le32(start);
		pushEntry(tag, type, count, offset);

		dataArea.push(le32(num));
		dataArea.push(le32(den));
		dataOff = dataOff + 8;
	}

	// ---- Build IFD0 (4 entries) ----
	writeAsciiTag(0x010f, makeBytes); // Make
	writeAsciiTag(0x0110, modelBytes); // Model
	writeRationalTag(0x011a, xres[0], xres[1]); // XResolution
	writeRationalTag(0x011b, yres[0], yres[1]); // YResolution

	const numEntries = le16(entries.length);
	const nextIFD = le32(0);
	const ifd0 = concat(numEntries, ...entries, nextIFD, ...dataArea);

	// APP1 payload must start with "Exif\0\0"
	const exifPrefix = concat(ascii("Exif"), new Uint8Array([0, 0]));
	return concat(exifPrefix, tiffHeader, ifd0);
}

/**
 * Wrap the APP1 payload into a minimal JPEG file:
 * SOI + APP1(Exif) + SOF0 (width/height) + EOI
 */
export function buildJpegWithExifAndSize(
	app1Payload: U8,
	size: { width: number; height: number },
): U8 {
	const SOI = new Uint8Array([0xff, 0xd8]);

	// APP1 segment: length field includes its own 2 bytes
	const app1Len = app1Payload.length + 2;
	const APP1 = concat(new Uint8Array([0xff, 0xe1]), be16(app1Len), app1Payload);

	// Minimal SOF0: precision(8), height, width, components=3 + 3 components * 3 bytes each
	const sofBody = concat(
		new Uint8Array([8]),
		be16(size.height),
		be16(size.width),
		new Uint8Array([3]),
		new Uint8Array([1, 0x22, 0]), // Y
		new Uint8Array([2, 0x11, 1]), // Cb
		new Uint8Array([3, 0x11, 1]), // Cr
	);
	const SOF0 = concat(
		new Uint8Array([0xff, 0xc0]),
		be16(2 + sofBody.length),
		sofBody,
	);

	const EOI = new Uint8Array([0xff, 0xd9]);

	return concat(SOI, APP1, SOF0, EOI);
}
