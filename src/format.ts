/**
 * @module format
 * Format common EXIF values into human-readable strings.
 */

/**
 * @description
 * Formats shutter speed (exposure time) into a human-readable string.
 * If the exposure time is greater than or equal to 1 second, it returns the time in seconds.
 * If the exposure time is less than 1 second, it returns the reciprocal as a fraction (e.g., "1/125").
 * If the input is not a valid number or less than or equal to zero, it returns undefined.
 * @param {number} [exposureTime] - The exposure time in seconds.
 * @returns {string | undefined} A formatted string representing the shutter speed, or undefined if input is invalid.
 */
export function formatShutter(exposureTime?: number): string | undefined {
  if (typeof exposureTime !== 'number' || exposureTime <= 0) {
    return;
  }
  if (exposureTime >= 1) {
    return `${Math.round(exposureTime * 10) / 10}s`;
  }
  const denom = Math.round(1 / exposureTime);
  return `1/${denom}`;
}

/**
 * @description
 * Formats ISO speed value into a human-readable string.
 * If the ISO value is not a valid number or less than or equal to zero, it returns undefined.
 * @param {number} [fNumber] - The ISO speed value.
 * @returns {string | undefined} A formatted string representing the ISO speed, or undefined if input is invalid.
 */
export function formatAperture(fNumber?: number): string | undefined {
  if (
    typeof fNumber !== 'number' ||
    !Number.isFinite(fNumber) ||
    fNumber <= 0
  ) {
    return;
  }
  const rounded = Math.round(fNumber * 10) / 10;
  return `f/${rounded}`;
}

const ExposureProgramMap: Record<number, string> = {
  0: 'Not defined',
  1: 'Manual',
  2: 'Normal program',
  3: 'Aperture priority',
  4: 'Shutter priority',
  5: 'Creative',
  6: 'Action',
  7: 'Portrait',
  8: 'Landscape',
};

/**
 * @description
 * Formats exposure program value into a human-readable string.
 * If the input is not a valid number, it returns undefined.
 * @param {number} [n] - The exposure program value.
 * @returns {string | undefined} A formatted string representing the exposure program, or undefined if input is invalid.
 */
export function formatExposureProgram(n?: number): string | undefined {
  if (typeof n !== 'number') {
    return;
  }
  return ExposureProgramMap[n] ?? `Unknown(${n})`;
}
