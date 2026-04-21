export const Orientation = {
  TOP_LEFT: 1,
  TOP_RIGHT: 2,
  BOTTOM_RIGHT: 3,
  BOTTOM_LEFT: 4,
  LEFT_TOP: 5,
  RIGHT_TOP: 6,
  RIGHT_BOTTOM: 7,
  LEFT_BOTTOM: 8,
} as const;

export type Orientation = (typeof Orientation)[keyof typeof Orientation];

export const ThumbnailType = {
  TIFF: 1,
  JPEG: 6,
} as const;

export type ThumbnailType = (typeof ThumbnailType)[keyof typeof ThumbnailType];

export interface ImageSize {
  height: number;
  width: number;
}

export const ExifSectionKind = {
  IFD0: 0,
  SubIFD: 1,
  GPSIFD: 2,
  IFD1: 3,
} as const;

export type ExifSectionKind =
  (typeof ExifSectionKind)[keyof typeof ExifSectionKind];

export interface ExifTagMap {
  ColorSpace?: number;
  CreateDate?: number | string;
  DateTimeOriginal?: number | string;
  ExposureCompensation?: number;
  ExposureProgram?: number;
  ExposureTime?: number;
  Flash?: number;
  FNumber?: number;
  FocalLength?: number;
  FocalLengthIn35mmFormat?: number;
  GPSAltitude?: number;
  GPSLatitude?: number | [number, number, number];
  GPSLongitude?: number | [number, number, number];
  ImageHeight?: number;
  ImageWidth?: number;
  ISO?: number;
  LensInfo?: number[];
  LensMake?: string;
  LensModel?: string;
  LensSpecification?: number[];
  Make?: string;
  MeteringMode?: number;
  Model?: string;
  ModifyDate?: number | string;
  Orientation?: Orientation;
  ResolutionUnit?: number;
  WhiteBalance?: number;
  XResolution?: number;
  YResolution?: number;
  [custom: string]: unknown;
}

export interface XmpData {
  createDate?: string;
  creator?: string;
  description?: string;
  label?: string;
  rating?: number;
  subject?: string[];
  title?: string;
}

export interface ParsedExif {
  /** formatted values for common tags (e.g., "ISO 100", "F/2.8") */
  formattedTags?: Partial<Record<keyof ExifTagMap, string>>;
  image?: ImageSize;
  /** simplified, commonly-used subset (dates→epoch, GPS→decimal, rationals→float) */
  tags: Partial<ExifTagMap>;
  /** raw name->value map (resolved names where possible, unknowns as "tag_0xXXXX") */
  tagsRaw: Record<string, unknown>;
  thumbnail?: ThumbnailInfo;
  /** XMP metadata (title, description, keywords, rating) if present */
  xmp?: XmpData;
}

export interface ThumbnailInfo {
  /** absolute byte offset from start of file (computed at parse time) */
  absoluteOffset?: number; // NEW
  length: number;
  /** offset from TIFF header start (i.e., 6 bytes after "Exif\0\0") */
  offsetFromTiff: number;
  type: ThumbnailType;
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
  code: ExifErrorCode;

  constructor(code: ExifErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ExifError";
  }
}
