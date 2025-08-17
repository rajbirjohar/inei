import { describe, expect, it } from 'vitest';
import { parseExifDateToEpochSeconds } from '../src/date-util';

// helper to compute expected epoch seconds
const utc = ({
  y,
  m,
  d,
  h,
  mi,
  s,
}: {
  y: number;
  m: number;
  d: number;
  h: number;
  mi: number;
  s: number;
}) => Math.floor(Date.UTC(y, m - 1, d, h, mi, s) / 1000);

describe('parseExifDateToEpochSeconds', () => {
  it('parses EXIF spec format "YYYY:MM:DD hh:mm:ss"', () => {
    const ts = parseExifDateToEpochSeconds('2020:12:31 23:59:59');
    expect(ts).toBe(utc({ y: 2020, m: 12, d: 31, h: 23, mi: 59, s: 59 }));
  });

  it('parses ISO Zulu "YYYY-MM-DDThh:mm:ssZ"', () => {
    const ts = parseExifDateToEpochSeconds('2024-05-10T12:34:56Z');
    expect(ts).toBe(utc({ y: 2024, m: 5, d: 10, h: 12, mi: 34, s: 56 }));
  });

  it('parses ISO with positive offset and applies it (ahead of UTC → subtract)', () => {
    // 12:34:56+02:30 local == 10:04:56 UTC
    const ts = parseExifDateToEpochSeconds('2024-05-10T12:34:56+02:30');
    expect(ts).toBe(
      utc({
        y: 2024,
        m: 5,
        d: 10,
        h: 10,
        mi: 4,
        s: 56,
      })
    );
  });

  it('parses ISO with negative offset and applies it (behind UTC → add)', () => {
    // 12:34:56-02:30 local == 15:04:56 UTC
    const ts = parseExifDateToEpochSeconds('2024-05-10T12:34:56-02:30');
    expect(ts).toBe(
      utc({
        y: 2024,
        m: 5,
        d: 10,
        h: 15,
        mi: 4,
        s: 56,
      })
    );
  });

  it('accepts ISO offsets without colon', () => {
    // +0230 without colon
    const ts = parseExifDateToEpochSeconds('2024-05-10T12:34:56+0230');
    expect(ts).toBe(
      utc({
        y: 2024,
        m: 5,
        d: 10,
        h: 10,
        mi: 4,
        s: 56,
      })
    );
  });

  it('falls back to Date.parse for loose inputs and returns undefined for bad', () => {
    // RFC 2822
    const loose = parseExifDateToEpochSeconds(
      'Fri, 21 Nov 1997 09:55:06 -0600'
    );
    expect(typeof loose).toBe('number');
    expect(Number.isFinite(loose)).toBe(true);

    expect(parseExifDateToEpochSeconds('')).toBeUndefined();
    expect(parseExifDateToEpochSeconds('not-a-date')).toBeUndefined();
  });
});
