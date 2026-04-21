/**
 * @module format
 * Format common EXIF values into human-readable strings.
 */

import { Orientation } from "./types";

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
  if (typeof exposureTime !== "number" || exposureTime <= 0) {
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
    typeof fNumber !== "number" ||
    !Number.isFinite(fNumber) ||
    fNumber <= 0
  ) {
    return;
  }
  const rounded = Math.round(fNumber * 10) / 10;
  return `f/${rounded}`;
}

/**
 * @description
 * Formats focal length into a human-readable string.
 * @param {number} [focalLength] - The focal length in millimeters.
 * @returns {string | undefined} A formatted string like "50mm", or undefined if input is invalid.
 */
export function formatFocalLength(focalLength?: number): string | undefined {
  if (
    typeof focalLength !== "number" ||
    !Number.isFinite(focalLength) ||
    focalLength <= 0
  ) {
    return;
  }
  const rounded = Math.round(focalLength * 10) / 10;
  // Drop the decimal if it's a whole number
  const display =
    rounded === Math.floor(rounded) ? Math.floor(rounded) : rounded;
  return `${display}mm`;
}

/**
 * @description
 * Formats an EXIF epoch-seconds timestamp into a locale date string.
 * @param {number} [epochSeconds] - Epoch seconds (as returned by the parser for date tags).
 * @returns {string | undefined} A formatted date string like "Oct 1, 2023, 12:34 PM", or undefined if input is invalid.
 */
export function formatDate(epochSeconds?: number): string | undefined {
  if (typeof epochSeconds !== "number" || !Number.isFinite(epochSeconds)) {
    return;
  }
  const d = new Date(epochSeconds * 1000);
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const OrientationDescriptions: Record<number, string> = {
  [Orientation.TOP_LEFT]: "Normal",
  [Orientation.TOP_RIGHT]: "Mirrored",
  [Orientation.BOTTOM_RIGHT]: "Rotated 180\u00B0",
  [Orientation.BOTTOM_LEFT]: "Mirrored, rotated 180\u00B0",
  [Orientation.LEFT_TOP]: "Mirrored, rotated 90\u00B0 CW",
  [Orientation.RIGHT_TOP]: "Rotated 90\u00B0 CW",
  [Orientation.RIGHT_BOTTOM]: "Mirrored, rotated 90\u00B0 CCW",
  [Orientation.LEFT_BOTTOM]: "Rotated 90\u00B0 CCW",
};

/**
 * @description
 * Formats EXIF orientation into a human-readable description.
 * @param {number} [orientation] - The EXIF orientation value (1-8).
 * @returns {string | undefined} A description like "Rotated 90° CW", or undefined if input is invalid.
 */
export function formatOrientation(orientation?: number): string | undefined {
  if (typeof orientation !== "number") {
    return;
  }
  return OrientationDescriptions[orientation];
}

/**
 * @description
 * Formats exposure compensation into a human-readable string.
 * @param {number} [ev] - The exposure compensation value in EV.
 * @returns {string | undefined} A formatted string like "+1.3 EV" or "0 EV", or undefined if input is invalid.
 */
export function formatExposureCompensation(ev?: number): string | undefined {
  if (typeof ev !== "number" || !Number.isFinite(ev)) {
    return;
  }
  const rounded = Math.round(ev * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded} EV`;
}

/**
 * @description
 * Formats a GPS coordinate (decimal degrees) into a human-readable string.
 * @param {number} lat - Latitude in decimal degrees.
 * @param {number} lon - Longitude in decimal degrees.
 * @returns {string | undefined} A formatted string like "37.7749° N, 122.4194° W", or undefined if inputs are invalid.
 */
export function formatGPSCoordinate(
  lat?: number,
  lon?: number
): string | undefined {
  if (
    typeof lat !== "number" ||
    typeof lon !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    return;
  }
  const latDir = lat >= 0 ? "N" : "S";
  const lonDir = lon >= 0 ? "E" : "W";
  const latAbs = Math.abs(Math.round(lat * 10000) / 10000);
  const lonAbs = Math.abs(Math.round(lon * 10000) / 10000);
  return `${latAbs}\u00B0 ${latDir}, ${lonAbs}\u00B0 ${lonDir}`;
}

const MeteringModeMap: Record<number, string> = {
  0: "Unknown",
  1: "Average",
  2: "Center-weighted average",
  3: "Spot",
  4: "Multi-spot",
  5: "Multi-segment",
  6: "Partial",
  255: "Other",
};

/**
 * @description
 * Formats metering mode value into a human-readable string.
 * @param {number} [n] - The metering mode value.
 * @returns {string | undefined} A formatted string, or undefined if input is invalid.
 */
export function formatMeteringMode(n?: number): string | undefined {
  if (typeof n !== "number") {
    return;
  }
  return MeteringModeMap[n] ?? `Unknown(${n})`;
}

const FlashMap: Record<number, string> = {
  0: "No flash",
  1: "Fired",
  5: "Fired, return not detected",
  7: "Fired, return detected",
  8: "On, did not fire",
  9: "On, fired",
  13: "On, return not detected",
  15: "On, return detected",
  16: "Off, did not fire",
  20: "Off, did not fire, return not detected",
  24: "Auto, did not fire",
  25: "Auto, fired",
  29: "Auto, fired, return not detected",
  31: "Auto, fired, return detected",
  32: "No flash function",
  48: "Off, no flash function",
  65: "Fired, red-eye reduction",
  69: "Fired, red-eye reduction, return not detected",
  71: "Fired, red-eye reduction, return detected",
  73: "On, red-eye reduction",
  77: "On, red-eye reduction, return not detected",
  79: "On, red-eye reduction, return detected",
  89: "Auto, fired, red-eye reduction",
  93: "Auto, fired, red-eye reduction, return not detected",
  95: "Auto, fired, red-eye reduction, return detected",
};

/**
 * @description
 * Formats flash value into a human-readable string.
 * @param {number} [n] - The flash value.
 * @returns {string | undefined} A formatted string, or undefined if input is invalid.
 */
export function formatFlash(n?: number): string | undefined {
  if (typeof n !== "number") {
    return;
  }
  return FlashMap[n] ?? `Unknown(${n})`;
}

const ExposureProgramMap: Record<number, string> = {
  0: "Not defined",
  1: "Manual",
  2: "Normal program",
  3: "Aperture priority",
  4: "Shutter priority",
  5: "Creative",
  6: "Action",
  7: "Portrait",
  8: "Landscape",
};

/**
 * @description
 * Formats exposure program value into a human-readable string.
 * If the input is not a valid number, it returns undefined.
 * @param {number} [n] - The exposure program value.
 * @returns {string | undefined} A formatted string representing the exposure program, or undefined if input is invalid.
 */
export function formatExposureProgram(n?: number): string | undefined {
  if (typeof n !== "number") {
    return;
  }
  return ExposureProgramMap[n] ?? `Unknown(${n})`;
}
