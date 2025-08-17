import { ByteStream } from "./byte-stream";
import {
	ExifSectionKind,
	type RawTagValue,
	type ReadValueInlineReturn,
	type ReadValuesByTypeReturn,
	type ThumbnailInfo,
	ThumbnailType,
} from "./types";

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
 * Enumeration of TIFF data types used in EXIF IFDs.
 */
export enum TiffType {
	BYTE = 1,
	ASCII = 2,
	SHORT = 3,
	LONG = 4,
	RATIONAL = 5,
	UNDEFINED = 7,
	SLONG = 9,
	SRATIONAL = 10,
}

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
	format: TiffType,
) => void;

/**
 * @description
 * Result type for reading IFDs from an APP1 payload.
 */
export interface ReadIFDsResult {
	ok: boolean;
	/** offset within the APP1 payload where TIFF header starts (i.e., 6) */
	tiffBase: number;
	thumbnail?: ThumbnailInfo & { compression?: number };
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
	// Expect "Exif\0\0"
	const sig = app1.readString(4);
	const zz = app1.readString(2);
	if (sig !== "Exif" || zz !== "\u0000\u0000") {
		return { ok: false, tiffBase: 0 };
	}

	const tiffBase = app1.tell(); // start of TIFF header
	const tiff = app1.branch(tiffBase); // from current

	// BOM
	const b0 = tiff.u8();
	const b1 = tiff.u8();
	if (b0 === 0x49 && b1 === 0x49) {
		tiff.setEndian("LE");
	} else if (b0 === 0x4d && b1 === 0x4d) {
		tiff.setEndian("BE");
	} else
		return {
			ok: false,
			tiffBase,
		};

	const magic = tiff.u16();
	if (magic !== 0x002a) return { ok: false, tiffBase };

	const firstIFDOffset = tiff.u32();
	const ifd0 = tiff.branch(firstIFDOffset);

	let exifIFDOffset: number | undefined;
	let gpsIFDOffset: number | undefined;
	let ifd1Offset: number | undefined;

	// IFD0
	ifd1Offset = readIFD(
		tiff,
		ifd0,
		ExifSectionKind.IFD0,
		onTag,
		(tagId, value) => {
			// Pointer tags (ExifOffset, GPSInfo)
			if (tagId === 0x8769 && typeof value === "number") {
				exifIFDOffset = value;
			}
			if (tagId === 0x8825 && typeof value === "number") {
				gpsIFDOffset = value;
			}
		},
	);

	// SubIFD (Exif)
	if (typeof exifIFDOffset === "number" && exifIFDOffset > 0) {
		const sub = tiff.branch(exifIFDOffset);
		readIFD(tiff, sub, ExifSectionKind.SubIFD, onTag);
	}

	// GPS IFD
	if (typeof gpsIFDOffset === "number" && gpsIFDOffset > 0) {
		const gps = tiff.branch(gpsIFDOffset);
		readIFD(tiff, gps, ExifSectionKind.GPSIFD, onTag);
	}

	// IFD1 (thumbnail)
	let thumb: ReadIFDsResult["thumbnail"];

	if (typeof ifd1Offset === "number" && ifd1Offset > 0) {
		const ifd1 = tiff.branch(ifd1Offset);
		let thumbOffset: number | undefined;
		let thumbLength: number | undefined;
		let compression: number | undefined; // 6=JPEG, 1=TIFF

		readIFD(tiff, ifd1, ExifSectionKind.IFD1, (sec, tagId, value, fmt) => {
			onTag(sec, tagId, value, fmt);
			if (tagId === 0x0201 && typeof value === "number") thumbOffset = value;
			if (tagId === 0x0202 && typeof value === "number") thumbLength = value;
			if (tagId === 0x0103 && typeof value === "number") compression = value;
		});

		if (
			typeof thumbOffset === "number" &&
			typeof thumbLength === "number" &&
			thumbLength > 0
		) {
			thumb = {
				type: compression === 6 ? ThumbnailType.JPEG : ThumbnailType.TIFF,
				offsetFromTiff: thumbOffset,
				length: thumbLength,
				compression,
			};
		}
	}

	return { ok: true, tiffBase, thumbnail: thumb };
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
function readIFD(
	tiff: ByteStream,
	dir: ByteStream,
	section: ExifSectionKind,
	onTag: OnTag,
	onPointer?: (tagId: number, value: number) => void,
): number {
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
			if (tiff.endianness() === "LE") {
				inline[0] = valueOrOffset & 0xff;
				inline[1] = (valueOrOffset >>> 8) & 0xff;
				inline[2] = (valueOrOffset >>> 16) & 0xff;
				inline[3] = (valueOrOffset >>> 24) & 0xff;
			} else {
				inline[3] = valueOrOffset & 0xff;
				inline[2] = (valueOrOffset >>> 8) & 0xff;
				inline[1] = (valueOrOffset >>> 16) & 0xff;
				inline[0] = (valueOrOffset >>> 24) & 0xff;
			}
			value = readValueInline(
				new ByteStream(inline, tiff.endianness()),
				type,
				count,
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
			typeof value === "number" &&
			(tagId === 0x8769 || tagId === 0x8825)
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
	count: number,
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
			return text.replace(/\0+$/, "");
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
			return undefined;
	}
}

/**
 * @description
 * Reads a value from the ByteStream based on the TIFF data type and count.
 * Returns the parsed value, which can be a single value or an array.
 * @param {ByteStream} s - The ByteStream to read from.
 * @param {TiffType} type - The TIFF data type of the value.
 * @param {number} count - The number of items of this type.
 * @return {ReadValuesByTypeReturn} - The parsed value, which can be a single value or an array.
 */
// exif-sections.ts (or wherever this lives)
export function readValueByType(
	s: ByteStream,
	type: TiffType.BYTE,
	count: 1,
): number;
export function readValueByType(
	s: ByteStream,
	type: TiffType.BYTE,
	count: number,
): number[];
export function readValueByType(
	s: ByteStream,
	type: TiffType.ASCII,
	count: number,
): string;
export function readValueByType(
	s: ByteStream,
	type: TiffType.SHORT,
	count: 1,
): number;
export function readValueByType(
	s: ByteStream,
	type: TiffType.SHORT,
	count: number,
): number[];
export function readValueByType(
	s: ByteStream,
	type: TiffType.LONG,
	count: 1,
): number;
export function readValueByType(
	s: ByteStream,
	type: TiffType.LONG,
	count: number,
): number[];
export function readValueByType(
	s: ByteStream,
	type: TiffType.SLONG,
	count: 1,
): number;
export function readValueByType(
	s: ByteStream,
	type: TiffType.SLONG,
	count: number,
): number[];
export function readValueByType(
	s: ByteStream,
	type: TiffType.RATIONAL,
	count: 1,
): [number, number];
export function readValueByType(
	s: ByteStream,
	type: TiffType.RATIONAL,
	count: number,
): [number, number][];
export function readValueByType(
	s: ByteStream,
	type: TiffType.SRATIONAL,
	count: 1,
): [number, number];
export function readValueByType(
	s: ByteStream,
	type: TiffType.SRATIONAL,
	count: number,
): [number, number][];
export function readValueByType(
	s: ByteStream,
	type: TiffType.UNDEFINED,
	count: number,
): Uint8Array;
export function readValueByType(
	s: ByteStream,
	type: TiffType,
	count: number,
):
	| string
	| number
	| number[]
	| [number, number]
	| [number, number][]
	| Uint8Array
	| undefined;
// Implementation signature (the one the body must satisfy)
export function readValueByType(
	s: ByteStream,
	type: TiffType,
	count: number,
):
	| string
	| number
	| number[]
	| [number, number]
	| [number, number][]
	| Uint8Array
	| undefined {
	switch (type) {
		case TiffType.BYTE: {
			if (count === 1) return s.u8();
			const arr = s.slice(count);
			return Array.from(arr);
		}
		case TiffType.ASCII: {
			const text = s.readString(count);
			return text.replace(/\0+$/, "");
		}
		case TiffType.SHORT: {
			const out: number[] = [];
			for (let i = 0; i < count; i++) out.push(s.u16());
			return count === 1 ? out[0] : out;
		}
		case TiffType.LONG: {
			const out: number[] = [];
			for (let i = 0; i < count; i++) out.push(s.u32());
			return count === 1 ? out[0] : out;
		}
		case TiffType.RATIONAL: {
			const out: [number, number][] = [];
			for (let i = 0; i < count; i++) out.push([s.u32(), s.u32()]);
			return count === 1 ? out[0] : out;
		}
		case TiffType.UNDEFINED: {
			return s.slice(count);
		}
		case TiffType.SLONG: {
			const out: number[] = [];
			for (let i = 0; i < count; i++) out.push(s.i32());
			return count === 1 ? out[0] : out;
		}
		case TiffType.SRATIONAL: {
			const out: [number, number][] = [];
			for (let i = 0; i < count; i++) out.push([s.i32(), s.i32()]);
			return count === 1 ? out[0] : out;
		}
		default:
			return undefined;
	}
}
