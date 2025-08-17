import { describe, expect, it } from 'vitest';
import { ByteStream } from '../src/byte-stream';
import { readValueByType, readValueInline } from '../src/exif-sections';
import { TiffType } from '../src/tiff-types';

describe('EXIF value readers', () => {
  it('readValueInline covers BYTE/ASCII/SHORT/LONG/UNDEFINED', () => {
    // inline buffer is 4 bytes (as it would be inside the IFD entry)
    // BYTE (count 4)
    {
      const s = new ByteStream(new Uint8Array([1, 2, 3, 4]), 'LE');
      expect(readValueInline(s, TiffType.BYTE, 4)).toEqual([1, 2, 3, 4]);
    }
    // ASCII (count 4)
    {
      const s = new ByteStream(new Uint8Array([65, 66, 67, 0]), 'LE');
      expect(readValueInline(s, TiffType.ASCII, 4)).toBe('ABC');
    }
    // SHORT (count 2) LE
    {
      const s = new ByteStream(new Uint8Array([1, 0, 2, 0]), 'LE');
      expect(readValueInline(s, TiffType.SHORT, 2)).toEqual([1, 2]);
    }
    // SHORT (count 2) BE
    {
      const s = new ByteStream(new Uint8Array([0, 1, 0, 2]), 'BE');
      expect(readValueInline(s, TiffType.SHORT, 2)).toEqual([1, 2]);
    }
    // LONG (count 1) LE
    {
      const s = new ByteStream(new Uint8Array([0x78, 0x56, 0x34, 0x12]), 'LE');
      expect(readValueInline(s, TiffType.LONG, 1)).toBe(0x12345678);
    }
    // UNDEFINED (count 4)
    {
      const s = new ByteStream(new Uint8Array([9, 8, 7, 6]), 'LE');
      const v = readValueInline(s, TiffType.UNDEFINED, 4);
      expect(v).toBeUndefined;
    }
  });

  it('readValueByType covers SHORT array, LONG array, RATIONAL, SRATIONAL', () => {
    // SHORT array
    {
      const s = new ByteStream(new Uint8Array([1, 0, 2, 0, 3, 0, 4, 0]), 'LE');
      expect(readValueByType(s, TiffType.SHORT, 4)).toEqual([1, 2, 3, 4]);
    }
    // LONG array
    {
      const s = new ByteStream(new Uint8Array([1, 0, 0, 0, 2, 0, 0, 0]), 'LE');
      expect(readValueByType(s, TiffType.LONG, 2)).toEqual([1, 2]);
    }
    // RATIONAL pair
    {
      const s = new ByteStream(new Uint8Array([10, 0, 0, 0, 2, 0, 0, 0]), 'LE');
      expect(readValueByType(s, TiffType.RATIONAL, 1)).toEqual([10, 2]);
    }
    // SRATIONAL negative
    {
      const s = new ByteStream(
        new Uint8Array([246, 255, 255, 255, 2, 0, 0, 0]),
        'LE'
      ); // -10/2
      expect(readValueByType(s, TiffType.SRATIONAL, 1)).toEqual([-10, 2]);
    }
  });
});
