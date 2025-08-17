// tiff-type.ts

// Runtime constants (small and tree-shakable)
export const TiffType = {
  BYTE: 1,
  ASCII: 2,
  SHORT: 3,
  LONG: 4,
  RATIONAL: 5,
  UNDEFINED: 7,
  SLONG: 9,
  SRATIONAL: 10,
} as const;

// Type = union of those numeric literals: 1 | 2 | 3 | 4 | 5 | 7 | 9 | 10
export type TiffType = (typeof TiffType)[keyof typeof TiffType];

// If you need names by value (since we lose enum's reverse mapping):
export const TiffTypeName: Record<TiffType, keyof typeof TiffType> = {
  [TiffType.BYTE]: 'BYTE',
  [TiffType.ASCII]: 'ASCII',
  [TiffType.SHORT]: 'SHORT',
  [TiffType.LONG]: 'LONG',
  [TiffType.RATIONAL]: 'RATIONAL',
  [TiffType.UNDEFINED]: 'UNDEFINED',
  [TiffType.SLONG]: 'SLONG',
  [TiffType.SRATIONAL]: 'SRATIONAL',
} as const;
