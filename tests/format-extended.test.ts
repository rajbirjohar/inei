import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatExposureCompensation,
  formatFlash,
  formatFocalLength,
  formatGPSCoordinate,
  formatMeteringMode,
  formatOrientation,
} from "../src/format";

describe("formatFocalLength", () => {
  it("formats whole number focal lengths", () => {
    expect(formatFocalLength(50)).toBe("50mm");
    expect(formatFocalLength(200)).toBe("200mm");
  });

  it("formats fractional focal lengths", () => {
    expect(formatFocalLength(35.5)).toBe("35.5mm");
  });

  it("rounds to one decimal", () => {
    expect(formatFocalLength(85.123)).toBe("85.1mm");
  });

  it("returns undefined for invalid input", () => {
    expect(formatFocalLength(undefined)).toBeUndefined();
    expect(formatFocalLength(0)).toBeUndefined();
    expect(formatFocalLength(-10)).toBeUndefined();
    expect(formatFocalLength(Number.NaN)).toBeUndefined();
    expect(formatFocalLength(Number.POSITIVE_INFINITY)).toBeUndefined();
  });
});

describe("formatDate", () => {
  it("formats epoch seconds to a readable date", () => {
    const result = formatDate(1696163696);
    expect(result).toBeDefined();
    expect(result).toContain("2023");
  });

  it("returns undefined for invalid input", () => {
    expect(formatDate(undefined)).toBeUndefined();
    expect(formatDate(Number.NaN)).toBeUndefined();
    expect(formatDate(Number.POSITIVE_INFINITY)).toBeUndefined();
  });
});

describe("formatOrientation", () => {
  it("returns description for all 8 orientations", () => {
    expect(formatOrientation(1)).toBe("Normal");
    expect(formatOrientation(2)).toBe("Mirrored");
    expect(formatOrientation(3)).toBe("Rotated 180\u00B0");
    expect(formatOrientation(4)).toBe("Mirrored, rotated 180\u00B0");
    expect(formatOrientation(5)).toBe("Mirrored, rotated 90\u00B0 CW");
    expect(formatOrientation(6)).toBe("Rotated 90\u00B0 CW");
    expect(formatOrientation(7)).toBe("Mirrored, rotated 90\u00B0 CCW");
    expect(formatOrientation(8)).toBe("Rotated 90\u00B0 CCW");
  });

  it("returns undefined for invalid input", () => {
    expect(formatOrientation(undefined)).toBeUndefined();
    expect(formatOrientation(0)).toBeUndefined();
    expect(formatOrientation(99)).toBeUndefined();
  });
});

describe("formatExposureCompensation", () => {
  it("formats positive EV", () => {
    expect(formatExposureCompensation(1.3)).toBe("+1.3 EV");
    expect(formatExposureCompensation(2)).toBe("+2 EV");
  });

  it("formats zero EV", () => {
    expect(formatExposureCompensation(0)).toBe("0 EV");
  });

  it("formats negative EV", () => {
    expect(formatExposureCompensation(-0.7)).toBe("-0.7 EV");
    expect(formatExposureCompensation(-3)).toBe("-3 EV");
  });

  it("returns undefined for invalid input", () => {
    expect(formatExposureCompensation(undefined)).toBeUndefined();
    expect(formatExposureCompensation(Number.NaN)).toBeUndefined();
    expect(
      formatExposureCompensation(Number.POSITIVE_INFINITY)
    ).toBeUndefined();
  });
});

describe("formatGPSCoordinate", () => {
  it("formats positive lat/lon (NE)", () => {
    const result = formatGPSCoordinate(37.7749, 122.4194);
    expect(result).toBe("37.7749\u00B0 N, 122.4194\u00B0 E");
  });

  it("formats negative lat/lon (SW)", () => {
    const result = formatGPSCoordinate(-33.8688, -151.2093);
    expect(result).toBe("33.8688\u00B0 S, 151.2093\u00B0 W");
  });

  it("returns undefined if either coordinate is missing", () => {
    expect(formatGPSCoordinate(37.7, undefined)).toBeUndefined();
    expect(formatGPSCoordinate(undefined, 122.4)).toBeUndefined();
    expect(formatGPSCoordinate(undefined, undefined)).toBeUndefined();
  });

  it("returns undefined for non-finite values", () => {
    expect(formatGPSCoordinate(Number.NaN, 0)).toBeUndefined();
    expect(formatGPSCoordinate(0, Number.POSITIVE_INFINITY)).toBeUndefined();
  });
});

describe("formatMeteringMode", () => {
  it("formats known metering modes", () => {
    expect(formatMeteringMode(1)).toBe("Average");
    expect(formatMeteringMode(2)).toBe("Center-weighted average");
    expect(formatMeteringMode(3)).toBe("Spot");
    expect(formatMeteringMode(5)).toBe("Multi-segment");
    expect(formatMeteringMode(255)).toBe("Other");
  });

  it("formats unknown values", () => {
    expect(formatMeteringMode(99)).toBe("Unknown(99)");
  });

  it("returns undefined for non-number", () => {
    expect(formatMeteringMode(undefined)).toBeUndefined();
  });
});

describe("formatFlash", () => {
  it("formats known flash values", () => {
    expect(formatFlash(0x00)).toBe("No flash");
    expect(formatFlash(0x01)).toBe("Fired");
    expect(formatFlash(0x10)).toBe("Off, did not fire");
    expect(formatFlash(0x19)).toBe("Auto, fired");
  });

  it("formats unknown flash values", () => {
    expect(formatFlash(0xff)).toBe("Unknown(255)");
  });

  it("returns undefined for non-number", () => {
    expect(formatFlash(undefined)).toBeUndefined();
  });
});
