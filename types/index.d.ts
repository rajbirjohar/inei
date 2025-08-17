/**
 * @description
 * A class for reading bytes from a Uint8Array or ArrayBuffer with bounds checking and endianness support.
 * It provides methods to read various data types, branch into substreams, and slice out data.
 * It also supports seeking, skipping, and marking positions in the stream.
 *
 * @example
 * ```typescript
 * const stream = ByteStream.from(myBuffer, "LE");
 * const value = stream.u16(); // Read a 16-bit unsigned integer
 * const subStream = stream.branch(10, 20); // Create a substream from byte 10 to 30
 * const slice = stream.slice(5); // Get a copy of the next 5 bytes as a Uint8Array
 *
 * // Read a string of 10 bytes
 * const str = stream.readString(10, "utf-8");
 *
 * // Check remaining bytes
 * const remaining = stream.remaining();
 *
 * // Seek to a specific position
 * stream.seek(50);
 *
 * // Skip the next 20 bytes
 * stream.skip(20);
 *
 * // Mark the current position and later reopen it
 * const mark = stream.mark();
 *
 * // Do some operations...
 * // Reopen the marked position
 * const reopenedStream = mark.reopen();
 *
 * // Read a 32-bit float
 * const floatValue = stream.f32();
 * ```
 */
declare class ByteStream {
    private readonly buf;
    /**
     * Creates a new ByteStream instance from a Uint8Array, ArrayBuffer, or Buffer.
     */
    private view;
    /**
     * Current byte offset in the stream.
     */
    private offset;
    /**
     * Endianness of the byte stream, either 'LE' (little-endian) or 'BE' (big-endian).
     */
    private little;
    /**
     * Base offset in the original buffer, useful for calculating absolute offsets.
     */
    private base;
    constructor(buf: Uint8Array, endian?: Endianness, base?: number);
    /**
     * @description
     * Creates a ByteStream instance from an ArrayBuffer, Uint8Array, or Buffer.
     * This method allows for easy instantiation from various input types,
     * with optional endianness specification.
     * @param {ArrayBuffer | Uint8Array | Buffer} input - The input data to create the ByteStream from.
     * @param {Endianness} [endian='LE'] - The endianness of the byte stream, either 'LE' (little-endian) or 'BE' (big-endian).
     * @return {ByteStream} A new ByteStream instance initialized with the input data.
     */
    static from(input: ArrayBuffer | Uint8Array | Buffer, endian?: Endianness): ByteStream;
    setEndian(endian: Endianness): void;
    flipEndian(): void;
    endianness(): Endianness;
    isLittleEndian(): boolean;
    tell(): number;
    size(): number;
    remaining(): number;
    /** Absolute base offset (in bytes) of this view within the original buffer. */
    baseOffset(): number;
    /** Convert a local offset to an absolute offset. */
    toAbsolute(localOffset?: number): number;
    seek(pos: number): this;
    skip(n: number): this;
    mark(): {
        offset: number;
        reopen: (delta?: number) => ByteStream;
    };
    branch(start: number, length?: number): ByteStream;
    slice(len: number): Uint8Array;
    readString(len: number, encoding?: string): string;
    private need;
    u8(): number;
    i8(): number;
    u16(): number;
    i16(): number;
    u32(): number;
    i32(): number;
    f32(): number;
    f64(): number;
    peekU16(): number;
}

/**
 * @description
 * Factory function to create an instance of ExifParser.
 * @param {ArrayBuffer | Uint8Array | Buffer} input - The input data to parse as EXIF.
 * @param {ParserOptions} [opts] - Optional parser options.
 * @returns {ExifParser} An instance of ExifParser initialized with the input data.
 */
export declare function createParser(input: ArrayBuffer | Uint8Array | Buffer, opts?: ParserOptions): ExifParser;

/**
 * @module ByteStream
 * A minimal, safe, endian-aware byte reader that works in both Node and browsers.
 * All read operations are bounds-checked. Consumers can branch into subranges
 * without copying, and optionally copy out slices when needed.
 *
 * Design:
 * - Wraps a DataView over a Uint8Array.
 * - Endianness ('LE' | 'BE') controls multi-byte numeric reads.
 * - `branch()` returns a new ByteStream window on the same underlying buffer.
 * - `slice()` returns a *copied* Uint8Array for immutable consumption.
 */
/**
 * @type Endianness
 * Represents the endianness of the byte stream.
 */
declare type Endianness = "LE" | "BE";

export declare class ExifError extends Error {
    code: ExifErrorCode;
    constructor(code: ExifErrorCode, message: string);
}

export declare type ExifErrorCode = "NOT_JPEG" | "NO_EXIF" | "INVALID_TIFF" | "TRUNCATED" | "UNKNOWN";

/**
 * @description
 * Main EXIF parser class that processes a JPEG stream and extracts EXIF data.
 */
export declare class ExifParser {
    private readonly stream;
    private readonly opts;
    /**
     * @param stream - Root ByteStream with the input file.
     * @param opts - Optional parser controls (see module docs).
     */
    constructor(stream: ByteStream, opts?: ParserOptions);
    /**
     * Parses the EXIF data from the JPEG stream.
     * @returns {ParsedExif} An object containing parsed EXIF data, image size, and thumbnail info.
     */
    parse(): {
        ok: true;
        data: ParsedExif;
    } | {
        ok: false;
        error: ExifError;
    };
}

export declare enum ExifSectionKind {
    IFD0 = 0,
    SubIFD = 1,
    GPSIFD = 2,
    IFD1 = 3
}

export declare interface ExifTagMap {
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

export declare interface ImageSize {
    width: number;
    height: number;
}

export declare enum Orientation {
    TOP_LEFT = 1,
    TOP_RIGHT = 2,
    BOTTOM_RIGHT = 3,
    BOTTOM_LEFT = 4,
    LEFT_TOP = 5,
    RIGHT_TOP = 6,
    RIGHT_BOTTOM = 7,
    LEFT_BOTTOM = 8
}

export declare interface ParsedExif {
    image?: ImageSize;
    thumbnail?: ThumbnailInfo;
    /** raw name->value map (resolved names where possible, unknowns as "tag_0xXXXX") */
    tagsRaw: Record<string, unknown>;
    /** simplified, commonly-used subset (dates→epoch, GPS→decimal, rationals→float) */
    tags: Partial<ExifTagMap>;
}

/**
 * @description
 * Parses EXIF data from the provided input.
 * @param {ArrayBuffer | Uint8Array | Buffer} input - The input data to parse as EXIF.
 * @param {ParserOptions} [opts] - Optional parser options.
 */
export declare function parseExif(input: ArrayBuffer | Uint8Array | Buffer, opts?: ParserOptions): {
    ok: true;
    data: ParsedExif;
} | {
    ok: false;
    error: ExifError;
};

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
export declare interface ParserOptions {
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

export declare type RawTagValue = ReadValueInlineReturn | ReadValuesByTypeReturn;

export declare type ReadValueInlineReturn = string | number | number[] | undefined;

export declare type ReadValuesByTypeReturn = string | number | number[] | Uint8Array<ArrayBufferLike> | [number, number] | [number, number][] | undefined;

export declare type SimplifiedTagValue = string | number | number[] | (number | null)[] | Uint8Array<ArrayBufferLike> | null | undefined;

export declare interface ThumbnailInfo {
    type: ThumbnailType;
    /** offset from TIFF header start (i.e., 6 bytes after "Exif\0\0") */
    offsetFromTiff: number;
    length: number;
}

export declare interface ThumbnailInfo {
    type: ThumbnailType;
    /** offset from TIFF header start (i.e., 6 bytes after "Exif\0\0") */
    offsetFromTiff: number;
    length: number;
    /** absolute byte offset from start of file (computed at parse time) */
    absoluteOffset?: number;
}

export declare enum ThumbnailType {
    TIFF = 1,
    JPEG = 6
}

export { }
