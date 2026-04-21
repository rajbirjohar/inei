import {
  formatAperture,
  formatDate,
  formatExposureCompensation,
  formatExposureProgram,
  formatFlash,
  formatFocalLength,
  formatGPSCoordinate,
  formatMeteringMode,
  formatOrientation,
  formatShutter,
} from "./format";
import type { SimplifiedTagValue } from "./types";

/**
 * @description
 * Computes formatted tags from a record of simplified tag values.
 * @param {Record<string, SimplifiedTagValue>} tags - A record of simplified tag values.
 * @returns {Record<string, string>} A record of formatted tag strings.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Flat list of tag formatters, not actually complex.
export function computeFormattedTags(
  tags: Record<string, SimplifiedTagValue>
): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof tags.ExposureTime === "number") {
    const s = formatShutter(tags.ExposureTime);
    if (s) {
      out.Shutter = s;
    }
  }
  if (typeof tags.FNumber === "number") {
    const s = formatAperture(tags.FNumber);
    if (s) {
      out.Aperture = s;
    }
  }
  if (typeof tags.ExposureProgram === "number") {
    const s = formatExposureProgram(tags.ExposureProgram);
    if (s) {
      out.ExposureProgram = s;
    }
  }
  if (typeof tags.ISO === "number") {
    out.ISO = `ISO ${tags.ISO}`;
  }
  if (typeof tags.FocalLength === "number") {
    const s = formatFocalLength(tags.FocalLength);
    if (s) {
      out.FocalLength = s;
    }
  }
  if (typeof tags.FocalLengthIn35mmFormat === "number") {
    const s = formatFocalLength(tags.FocalLengthIn35mmFormat);
    if (s) {
      out.FocalLengthIn35mmFormat = s;
    }
  }
  if (typeof tags.ExposureCompensation === "number") {
    const s = formatExposureCompensation(tags.ExposureCompensation);
    if (s) {
      out.ExposureCompensation = s;
    }
  }
  if (typeof tags.DateTimeOriginal === "number") {
    const s = formatDate(tags.DateTimeOriginal);
    if (s) {
      out.DateTimeOriginal = s;
    }
  }
  if (typeof tags.Orientation === "number") {
    const s = formatOrientation(tags.Orientation);
    if (s) {
      out.Orientation = s;
    }
  }
  if (typeof tags.MeteringMode === "number") {
    const s = formatMeteringMode(tags.MeteringMode);
    if (s) {
      out.MeteringMode = s;
    }
  }
  if (typeof tags.Flash === "number") {
    const s = formatFlash(tags.Flash);
    if (s) {
      out.Flash = s;
    }
  }
  if (
    typeof tags.GPSLatitude === "number" &&
    typeof tags.GPSLongitude === "number"
  ) {
    const s = formatGPSCoordinate(
      tags.GPSLatitude as number,
      tags.GPSLongitude as number
    );
    if (s) {
      out.GPS = s;
    }
  }
  if (typeof tags.Make === "string") {
    out.Make = tags.Make;
  }
  if (typeof tags.Model === "string") {
    out.Model = tags.Model;
  }
  if (typeof tags.LensMake === "string") {
    out.LensMake = tags.LensMake;
  }
  if (typeof tags.LensModel === "string") {
    out.LensModel = tags.LensModel;
  }
  return out;
}
