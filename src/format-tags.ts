import { formatAperture, formatExposureProgram, formatShutter } from './format';
import type { SimplifiedTagValue } from './types';

/**
 * @description
 * Computes formatted tags from a record of simplified tag values.
 * @param {Record<string, SimplifiedTagValue>} tags - A record of simplified tag values.
 * @returns {Record<string, string>} A record of formatted tag strings.
 */
export function computeFormattedTags(
  tags: Record<string, SimplifiedTagValue>
): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof tags.ExposureTime === 'number') {
    const s = formatShutter(tags.ExposureTime);
    if (s) {
      out.Shutter = s;
    }
  }
  if (typeof tags.FNumber === 'number') {
    const s = formatAperture(tags.FNumber);
    if (s) {
      out.Aperture = s;
    }
  }
  if (typeof tags.ExposureProgram === 'number') {
    const s = formatExposureProgram(tags.ExposureProgram);
    if (s) {
      out.ExposureProgram = s;
    }
  }
  if (typeof tags.ISO === 'number') {
    out.ISO = `ISO ${tags.ISO}`;
  }
  return out;
}
