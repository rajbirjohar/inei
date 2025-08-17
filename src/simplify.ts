import { parseExifDateToEpochSeconds } from './date-util';
import type { TiffType as TiffTypeId } from './tiff-types'; // VALUE (object with constants)
import { ExifSectionKind } from './types';

/**
 * @module simplify
 * Pure helpers to "simplify" raw EXIF values into friendlier numbers.
 *
 * - simplifyRationals: [num,den] -> num/den (array-aware)
 * - castDegreeValues: GPS DMS arrays + direction refs -> decimal degrees
 * - castDateValues: EXIF strings ("YYYY:MM:DD hh:mm:ss" or ISO) -> epoch seconds
 *
 * These functions are side-effect-free except for the provided set() mutator
 * in the GPS/date casters, which updates a user-supplied map.
 */

export type SimplifiedTagValue =
  | string
  | number
  | number[]
  | (number | null)[] // allow nulls if you prefer them over NaN
  | Uint8Array
  | null
  | undefined;

export type SimplifyOptions = {
  zeroDenIsNull?: boolean;
};

const isPair = (v: unknown): v is [number, number] =>
  Array.isArray(v) &&
  v.length === 2 &&
  typeof v[0] === 'number' &&
  typeof v[1] === 'number';

const isPairArray = (v: unknown): v is [number, number][] =>
  Array.isArray(v) && v.every(isPair);

/**
 * @description
 * Simplifies rational values from EXIF.
 * Converts [num, den] arrays to num/den ratio.
 * Handles both RATIONAL (5) and SRATIONAL (10) formats.
 * @param values - The values to simplify, can be an array or a single value.
 * @param format - The format of the values, either 5 (RATIONAL) or 10 (SRATIONAL).
 * @return The simplified value(s). If the input is an array, returns an array of simplified values.
 */
// export function simplifyRationals(
//   values: [number, number],
//   _format: TiffType.RATIONAL | TiffType.SRATIONAL,
//   opts?: SimplifyOptions
// ): number | null;
// export function simplifyRationals(
//   values: [number, number][],
//   _format: TiffType.RATIONAL | TiffType.SRATIONAL,
//   opts?: SimplifyOptions
// ): (number | null)[];
// export function simplifyRationals(
//   values: unknown,
//   _format: TiffType.RATIONAL | TiffType.SRATIONAL,
//   opts?: SimplifyOptions
// ): SimplifiedTagValue;
export function simplifyRationals(
  values: unknown,
  _format: TiffTypeId,
  opts: SimplifyOptions = { zeroDenIsNull: true }
): SimplifiedTagValue {
  if (values == null) {
    return values;
  }

  const toNum = ([num, den]: [number, number]) =>
    den === 0 ? (opts.zeroDenIsNull ? null : Number.NaN) : num / den;

  if (isPair(values)) {
    return toNum(values);
  }

  if (isPairArray(values)) {
    const out = values.map(toNum);
    return out.length === 1 ? out[0] : out;
  }
  return values as SimplifiedTagValue;
}

type Getter = (q: {
  section: ExifSectionKind;
  type: number;
  name?: string;
}) => unknown;
type Setter = (
  q: { section: ExifSectionKind; type: number; name?: string },
  val: SimplifiedTagValue
) => void;

export function castDegreeValues(get: Getter, set: Setter): void {
  const pairs = [
    {
      section: ExifSectionKind.GPSIFD,
      type: 0x0002,
      name: 'GPSLatitude',
      refType: 0x0001,
      refName: 'GPSLatitudeRef',
      pos: 'N' as const,
    },
    {
      section: ExifSectionKind.GPSIFD,
      type: 0x0004,
      name: 'GPSLongitude',
      refType: 0x0003,
      refName: 'GPSLongitudeRef',
      pos: 'E' as const,
    },
  ];

  for (const p of pairs) {
    const arr = get({ section: p.section, type: p.type, name: p.name });
    if (!Array.isArray(arr)) {
      continue;
    }
    const a = arr as unknown[];
    if (
      typeof a[0] !== 'number' ||
      typeof a[1] !== 'number' ||
      typeof a[2] !== 'number'
    ) {
      continue;
    }

    const deg = a[0] as number;
    const min = a[1] as number;
    const sec = a[2] as number;

    const ref = get({ section: p.section, type: p.refType, name: p.refName });
    const sign = ref === p.pos ? +1 : -1;
    const dec = (deg + min / 60 + sec / 3600) * sign;
    set({ section: p.section, type: p.type, name: p.name }, dec);
  }
}

export function castDateValues(get: Getter, set: Setter): void {
  const keys = [
    { section: ExifSectionKind.SubIFD, type: 0x0132, name: 'ModifyDate' },
    { section: ExifSectionKind.SubIFD, type: 0x9003, name: 'DateTimeOriginal' },
    { section: ExifSectionKind.SubIFD, type: 0x9004, name: 'CreateDate' },
  ];

  for (const k of keys) {
    const raw = get(k);
    if (typeof raw !== 'string') {
      continue;
    }
    const ts = parseExifDateToEpochSeconds(raw);
    if (typeof ts === 'number' && Number.isFinite(ts)) {
      set(k, ts);
    }
  }
}
