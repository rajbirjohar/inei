import { describe, expect, it } from "vitest";
import { computeFormattedTags } from "../src/format-tags";

describe("computeFormattedTags", () => {
  it("formats all supported tag types", () => {
    const tags = {
      ExposureTime: 0.008,
      FNumber: 2.8,
      ExposureProgram: 3,
      ISO: 400,
      FocalLength: 50,
      FocalLengthIn35mmFormat: 75,
      ExposureCompensation: -0.7,
      DateTimeOriginal: 1696163696,
      Orientation: 6,
      MeteringMode: 5,
      Flash: 0x10,
      GPSLatitude: 37.7749,
      GPSLongitude: -122.4194,
      Make: "Canon",
      Model: "EOS R6",
      LensMake: "Canon",
      LensModel: "RF50mm F1.8 STM",
    };

    const out = computeFormattedTags(tags);

    expect(out.Shutter).toBe("1/125");
    expect(out.Aperture).toBe("f/2.8");
    expect(out.ExposureProgram).toBe("Aperture priority");
    expect(out.ISO).toBe("ISO 400");
    expect(out.FocalLength).toBe("50mm");
    expect(out.FocalLengthIn35mmFormat).toBe("75mm");
    expect(out.ExposureCompensation).toBe("-0.7 EV");
    expect(out.DateTimeOriginal).toBeDefined();
    expect(out.Orientation).toBe("Rotated 90\u00B0 CW");
    expect(out.MeteringMode).toBe("Multi-segment");
    expect(out.Flash).toBe("Off, did not fire");
    expect(out.GPS).toContain("37.7749");
    expect(out.Make).toBe("Canon");
    expect(out.Model).toBe("EOS R6");
    expect(out.LensMake).toBe("Canon");
    expect(out.LensModel).toBe("RF50mm F1.8 STM");
  });

  it("handles empty tags", () => {
    const out = computeFormattedTags({});
    expect(Object.keys(out)).toHaveLength(0);
  });

  it("skips tags with invalid values", () => {
    const tags = {
      ExposureTime: -1,
      FNumber: 0,
      ISO: undefined,
      FocalLength: undefined,
    };

    const out = computeFormattedTags(tags as Record<string, unknown>);
    expect(out.Shutter).toBeUndefined();
    expect(out.Aperture).toBeUndefined();
    expect(out.ISO).toBeUndefined();
    expect(out.FocalLength).toBeUndefined();
  });

  it("only includes tags that are present", () => {
    const tags = { ISO: 100, Make: "Sony" };
    const out = computeFormattedTags(tags);

    expect(out.ISO).toBe("ISO 100");
    expect(out.Make).toBe("Sony");
    expect(out.Shutter).toBeUndefined();
    expect(out.Aperture).toBeUndefined();
  });

  it("does not include GPS when only one coordinate is present", () => {
    const out1 = computeFormattedTags({ GPSLatitude: 37.7 });
    expect(out1.GPS).toBeUndefined();

    const out2 = computeFormattedTags({ GPSLongitude: -122.4 });
    expect(out2.GPS).toBeUndefined();
  });
});
