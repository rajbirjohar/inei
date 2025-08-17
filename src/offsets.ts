import type { ExifTagMap } from './types';

/**
 * @module offsets
 * Adjust EXIF date/time tags by applying time zone offsets.
 */

const spec = /^([+-])(\d{2}):(\d{2})/;

/**
 * @description
 * Parses an EXIF offset string (±HH:MM) into seconds.
 * @param {string} s - The offset string to parse, e.g., "+02:00" or "-05:30".
 * @returns {number | undefined} The offset in seconds, or undefined if parsing fails.
 */
function parseOffset(s: string): number | undefined {
  // ±HH:MM
  const m = spec.exec(s);
  if (!m) {
    return;
  }
  const sign = m[1] === '-' ? -1 : 1;
  const h = Number(m[2]);
  const min = Number(m[3]);
  return sign * (h * 3600 + min * 60);
}

/**
 * @description
 * If OffsetTime*, adjust EXIF epoch fields so they represent true UTC.
 * Assumes DateTime* were parsed with Date.UTC(y,mo,d,h,mi,s) (no tz).
 * @param {ExifTagMap} tags - The EXIF tag map to modify.
 */
export function applyExifOffsetTags(tags: ExifTagMap): void {
  const pairs: [timeKey: string, offsetKey: string][] = [
    ['DateTimeOriginal', 'OffsetTimeOriginal'],
    ['CreateDate', 'OffsetTimeDigitized'],
    ['ModifyDate', 'OffsetTime'],
  ];

  for (const [tk, ok] of pairs) {
    const t = tags[tk];
    const off = tags[ok];
    if (typeof t === 'number' && typeof off === 'string') {
      const sec = parseOffset(off);
      if (typeof sec === 'number') {
        // We originally treated local time as UTC; true UTC = local - offset
        tags[tk] = t - sec;
      }
    }
  }
}
