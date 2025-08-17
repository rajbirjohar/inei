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
export type Endianness = 'LE' | 'BE';

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
export class ByteStream {
  /**
   * Internal buffer containing the byte stream data.
   */
  private readonly buf: Uint8Array;
  /**
   * Creates a new ByteStream instance from a Uint8Array, ArrayBuffer, or Buffer.
   */
  view: DataView;
  /**
   * Current byte offset in the stream.
   */
  private offset = 0;
  /**
   * Endianness of the byte stream, either 'LE' (little-endian) or 'BE' (big-endian).
   */
  private little = true;
  /**
   * Base offset in the original buffer, useful for calculating absolute offsets.
   */
  base = 0;

  constructor(buf: Uint8Array, endian: Endianness = 'LE', base = 0) {
    this.buf = buf;
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    this.setEndian(endian);
    this.base = base;
  }

  /**
   * @description
   * Creates a ByteStream instance from an ArrayBuffer, Uint8Array, or Buffer.
   * This method allows for easy instantiation from various input types,
   * with optional endianness specification.
   * @param {ArrayBuffer | Uint8Array | Buffer} input - The input data to create the ByteStream from.
   * @param {Endianness} [endian='LE'] - The endianness of the byte stream, either 'LE' (little-endian) or 'BE' (big-endian).
   * @return {ByteStream} A new ByteStream instance initialized with the input data.
   */
  static from(
    input: ArrayBuffer | Uint8Array | Buffer,
    endian: Endianness = 'LE'
  ): ByteStream {
    if (input instanceof Uint8Array) {
      return new ByteStream(input, endian, 0);
    }
    if (
      typeof Buffer !== 'undefined' &&
      typeof globalThis.Buffer !== 'undefined' &&
      input instanceof globalThis.Buffer
    ) {
      const b = input as unknown as Uint8Array;
      return new ByteStream(
        new Uint8Array(b.buffer, b.byteOffset, b.byteLength),
        endian,
        0
      );
    }
    if (input instanceof ArrayBuffer) {
      return new ByteStream(new Uint8Array(input), endian, 0);
    }
    throw new TypeError('Unsupported input type for ByteStream');
  }

  setEndian(endian: Endianness) {
    this.little = endian === 'LE';
  }
  flipEndian() {
    this.little = !this.little;
  }
  endianness(): Endianness {
    return this.little ? 'LE' : 'BE';
  }
  isLittleEndian(): boolean {
    return this.little;
  }

  tell(): number {
    return this.offset;
  }
  size(): number {
    return this.view.byteLength;
  }
  remaining(): number {
    return this.size() - this.offset;
  }

  /** Absolute base offset (in bytes) of this view within the original buffer. */
  baseOffset(): number {
    return this.base;
  }
  /** Convert a local offset to an absolute offset. */
  toAbsolute(localOffset = 0): number {
    return this.base + localOffset;
  }

  seek(pos: number): this {
    // Check if the position is within bounds
    if (pos < 0 || pos > this.size()) {
      throw new RangeError(`seek OOB: ${pos}/${this.size()}`);
    }
    this.offset = pos;
    return this;
  }

  skip(n: number): this {
    return this.seek(this.offset + n);
  }

  mark() {
    const start = this.tell();
    return { offset: start, reopen: (delta = 0) => this.branch(start + delta) };
  }

  branch(start: number, length?: number): ByteStream {
    // Local reference to length
    let range = length;
    if (!range) {
      range = this.size() - start;
    }
    if (start < 0 || start + range > this.size()) {
      throw new RangeError(`branch OOB: start=${start}, length=${range}`);
    }
    const abs = this.base + start;
    const u8 = new Uint8Array(
      this.buf.buffer,
      this.buf.byteOffset + start,
      range
    );

    return new ByteStream(u8, this.little ? 'LE' : 'BE', abs);
  }

  slice(len: number): Uint8Array {
    // Check if the length is valid
    if (len < 0 || this.remaining() < len) {
      throw new RangeError(
        `slice OOB: len=${len}, remaining=${this.remaining()}`
      );
    }
    const u8 = new Uint8Array(
      this.buf.buffer,
      this.buf.byteOffset + this.offset,
      len
    );
    this.offset += len;
    return new Uint8Array(u8);
  }

  readString(len: number, encoding = 'utf-8'): string {
    const u8 = this.slice(len);
    const td: { decode: (b: Uint8Array) => string } =
      typeof TextDecoder !== 'undefined'
        ? new TextDecoder(encoding)
        : { decode: (b) => String.fromCharCode(...b) };
    return td.decode(u8);
  }

  private need(n: number): void {
    // Check if the requested number of bytes is available
    if (this.remaining() < n) {
      throw new RangeError(`read OOB: need ${n}, have ${this.remaining()}`);
    }
  }

  u8(): number {
    this.need(1);
    const v = this.view.getUint8(this.offset);
    this.offset += 1;
    return v;
  }
  i8(): number {
    this.need(1);
    const v = this.view.getInt8(this.offset);
    this.offset += 1;
    return v;
  }
  u16(): number {
    this.need(2);
    const v = this.view.getUint16(this.offset, this.little);
    this.offset += 2;
    return v;
  }
  i16(): number {
    this.need(2);
    const v = this.view.getInt16(this.offset, this.little);
    this.offset += 2;
    return v;
  }
  u32(): number {
    this.need(4);
    const v = this.view.getUint32(this.offset, this.little);
    this.offset += 4;
    return v;
  }
  i32(): number {
    this.need(4);
    const v = this.view.getInt32(this.offset, this.little);
    this.offset += 4;
    return v;
  }
  f32(): number {
    this.need(4);
    const v = this.view.getFloat32(this.offset, this.little);
    this.offset += 4;
    return v;
  }
  f64(): number {
    this.need(8);
    const v = this.view.getFloat64(this.offset, this.little);
    this.offset += 8;
    return v;
  }

  peekU16(): number {
    const p = this.tell();
    const v = this.u16();
    this.seek(p);
    return v;
  }
}
