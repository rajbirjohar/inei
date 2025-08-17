import { describe, expect, it } from 'vitest';

import { simplifyRationals } from '../src/simplify';
import { TiffType } from '../src/tiff-types';

describe('simplifyRationals', () => {
  it('pair → number', () => {
    expect(simplifyRationals([18, 10], TiffType.RATIONAL)).toBe(1.8);
  });
  it('array of pairs → number[]', () => {
    expect(
      simplifyRationals(
        [
          [240, 1],
          [300, 1],
        ],
        TiffType.RATIONAL
      )
    ).toEqual([240, 300]);
  });
  it('0 denominator → null by default', () => {
    expect(simplifyRationals([0, 0], TiffType.RATIONAL)).toBeNull();
  });
  it('passes through non-rational shapes', () => {
    expect(simplifyRationals('abc', TiffType.RATIONAL)).toBe('abc');
  });
});
