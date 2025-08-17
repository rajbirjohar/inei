import { describe, expect, it } from 'vitest';
import { ByteStream } from '../src/byte-stream';
import { readValueByType } from '../src/exif-sections';
import { TiffType } from '../src/tiff-types';

describe('readValueByType', () => {
  it('ASCII trims trailing NULs', () => {
    const s = new ByteStream(new TextEncoder().encode('Hello\0'), 'LE');
    expect(readValueByType(s, TiffType.ASCII, 6)).toBe('Hello');
  });

  it('SHORT scalar and array', () => {
    const s = new ByteStream(new Uint8Array([1, 0, 2, 0]), 'LE');
    expect(readValueByType(s, TiffType.SHORT, 1)).toBe(1);
    const s2 = new ByteStream(new Uint8Array([3, 0, 4, 0]), 'LE');
    expect(readValueByType(s2, TiffType.SHORT, 2)).toEqual([3, 4]);
  });

  it('RATIONAL returns pairs', () => {
    const s = new ByteStream(new Uint8Array([10, 0, 0, 0, 2, 0, 0, 0]), 'LE');
    expect(readValueByType(s, TiffType.RATIONAL, 1)).toEqual([10, 2]);
  });

  it('UNDEFINED returns bytes', () => {
    const s = new ByteStream(new Uint8Array([9, 8, 7, 6]), 'LE');
    const v = readValueByType(s, TiffType.UNDEFINED, 4);
    expect(v).toBeInstanceOf(Uint8Array);
    expect(Array.from(v as Uint8Array)).toEqual([9, 8, 7, 6]);
  });
});
