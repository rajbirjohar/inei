export enum Orientation {
	TOP_LEFT = 1,
	TOP_RIGHT,
	BOTTOM_RIGHT,
	BOTTOM_LEFT,
	LEFT_TOP,
	RIGHT_TOP,
	RIGHT_BOTTOM,
	LEFT_BOTTOM,
}

export enum ThumbnailType {
	TIFF = 1,
	JPEG = 6,
}

export interface ImageSize {
	width: number;
	height: number;
}

export interface ThumbnailInfo {
	type: ThumbnailType;
	/** offset from TIFF header start (i.e., 6 bytes after "Exif\0\0") */
	offsetFromTiff: number;
	length: number;
}

export enum ExifSectionKind {
	IFD0 = 0,
	SubIFD = 1,
	GPSIFD = 2,
	IFD1 = 3,
}

export interface ExifTagMap {
	Orientation?: Orientation;
	ImageWidth?: number;
	ImageHeight?: number;
	XResolution?: number;
	YResolution?: number;
	ResolutionUnit?: number;
	Make?: string;
	Model?: string;
	ISO?: number;
	FNumber?: number;
	ExposureTime?: number;
	FocalLength?: number;
	DateTimeOriginal?: number | string;
	CreateDate?: number | string;
	ModifyDate?: number | string;
	GPSLatitude?: number | [number, number, number];
	GPSLongitude?: number | [number, number, number];
	ExposureProgram?: number;
	[custom: string]: unknown;
}

export interface ParsedExif {
	image?: ImageSize;
	thumbnail?: ThumbnailInfo;
	/** raw name->value map (resolved names where possible, unknowns as "tag_0xXXXX") */
	tagsRaw: Record<string, unknown>;
	/** simplified, commonly-used subset (dates→epoch, GPS→decimal, rationals→float) */
	tags: Partial<ExifTagMap>;
}

export interface ThumbnailInfo {
	type: ThumbnailType;
	/** offset from TIFF header start (i.e., 6 bytes after "Exif\0\0") */
	offsetFromTiff: number;
	length: number;
	/** absolute byte offset from start of file (computed at parse time) */
	absoluteOffset?: number; // NEW
}

export type ReadValueInlineReturn = string | number | number[] | undefined;

export type ReadValuesByTypeReturn =
	| string
	| number
	| number[]
	| Uint8Array<ArrayBufferLike>
	| [number, number] // ← add this
	| [number, number][]
	| undefined;

// (Optional convenience)
export type RawTagValue = ReadValueInlineReturn | ReadValuesByTypeReturn;

export type SimplifiedTagValue =
	| string
	| number
	| number[] // e.g., resolutions after rational simplify
	| (number | null)[] // rational arrays when some pairs are 0/0 -> null
	| Uint8Array<ArrayBufferLike>
	| null
	| undefined;

export type ExifErrorCode =
	| "NOT_JPEG"
	| "NO_EXIF"
	| "INVALID_TIFF"
	| "TRUNCATED"
	| "UNKNOWN";

export class ExifError extends Error {
	constructor(
		public code: ExifErrorCode,
		message: string,
	) {
		super(message);
		this.name = "ExifError";
	}
}
