# inei

EXIF and XMP metadata parser for JPEG, PNG, and HEIC/HEIF/AVIF. Written in TypeScript. Zero dependencies. Runs in browsers and Node.js.

Built as a modern replacement for [exifr](https://github.com/MikeKovarik/exifr), which has been unmaintained since 2022.

## Install

```bash
pnpm add inei
```

```bash
npm install inei
```

## Quick start

```typescript
import { parseExif } from "inei";

const buffer = await file.arrayBuffer();
const result = parseExif(buffer);

if (result.ok) {
  const { image, tags, xmp } = result.data;
}
```

`parseExif` returns a discriminated union. On success, `result.ok` is `true` and `result.data` contains the parsed metadata. On failure, `result.ok` is `false` and `result.error` is an `ExifError` with a `code` and `message`.

```typescript
type Result =
  | { ok: true; data: ParsedExif }
  | { ok: false; error: ExifError };
```

## Format support

| Format         | EXIF | Image size | XMP          | Thumbnail |
| -------------- | ---- | ---------- | ------------ | --------- |
| JPEG           | Yes  | Yes (SOF)  | Yes (APP1)   | Yes       |
| PNG            | Yes (eXIf chunk) | Yes (IHDR) | Yes (iTXt) | Yes |
| HEIC/HEIF/AVIF | Yes (ISOBMFF)    | Yes (ispe) | Yes (mime item) | Yes |

Format is auto-detected from magic bytes. You do not need to specify it.

## API

### `parseExif(input, options?)`

Synchronous. Accepts `ArrayBuffer`, `Uint8Array`, or `Buffer`.

```typescript
import { parseExif } from "inei";

const result = parseExif(buffer);
```

### `parseExifFromBlob(input, options?)`

Async. Accepts everything `parseExif` does, plus `Blob` and `File`. Use this in browsers when working with file inputs directly.

```typescript
import { parseExifFromBlob } from "inei";

const input = document.querySelector("input[type=file]");
const file = input.files[0];
const result = await parseExifFromBlob(file);
```

### `gps(input)`

Returns `{ latitude: number; longitude: number }` or `undefined`.

```typescript
import { gps } from "inei";

const coords = gps(buffer);
// { latitude: 37.7749, longitude: -122.4194 }
```

### `orientation(input)`

Returns the EXIF orientation value (1-8) or `undefined`.

```typescript
import { orientation } from "inei";

const o = orientation(buffer); // 1 = normal, 6 = rotated 90 CW, etc.
```

### `thumbnail(input)`

Returns the embedded JPEG thumbnail as a `Uint8Array`, or `undefined`.

```typescript
import { thumbnail } from "inei";

const bytes = thumbnail(buffer);
```

### `thumbnailUrl(input)`

Browser only. Returns a `blob:` URL for the embedded thumbnail, or `undefined`.

```typescript
import { thumbnailUrl } from "inei";

img.src = thumbnailUrl(buffer);
```

### `extractThumbnail(input, parsedExif)`

Lower-level thumbnail extraction. Use this when you already have a `ParsedExif` result and want to avoid parsing twice.

```typescript
import { parseExif, extractThumbnail } from "inei";

const result = parseExif(buffer);
if (result.ok && result.data.thumbnail) {
  const bytes = extractThumbnail(buffer, result.data);
}
```

## Options

All options are optional. Defaults are shown.

```typescript
parseExif(buffer, {
  readBinaryTags: false,    // Include UNDEFINED (binary blob) tags
  resolveTagNames: true,    // Map numeric tag IDs to human-readable names
  simplifyValues: true,     // Convert rationals to floats, dates to epoch seconds, GPS to decimal degrees
  imageSize: true,          // Extract width/height from container (SOF, IHDR, ispe)
  hidePointers: true,       // Omit internal IFD pointer tags (ExifOffset, GPSInfo, etc.)
  returnTags: true,         // Include the tag map in the result
  includeFormatted: false,  // Include pre-formatted strings for common tags
});
```

## Result shape

```typescript
type ParsedExif = {
  image?: { width: number; height: number };
  thumbnail?: ThumbnailInfo;
  tags: Partial<ExifTagMap>;       // Simplified values (numbers, strings, decimal degrees)
  tagsRaw: Record<string, unknown>; // Same keys, before simplification
  formattedTags?: Record<string, string>; // Only present when includeFormatted: true
  xmp?: XmpData;                   // Only present when XMP metadata exists
};
```

## Tags

With `simplifyValues: true` (the default), values are post-processed:

- Rationals (`[num, den]`) become floats (`num / den`)
- Dates (`"2023:10:22 18:46:07"`) become epoch seconds (`1697999167`)
- GPS DMS arrays become decimal degrees (`37.7749`)
- Timezone offsets are applied to date values

The `tags` object is typed as `Partial<ExifTagMap>`. Known tags have typed keys. Unknown tags appear as `tag_0x{hex}`.

### EXIF tags extracted

**Camera**: Make, Model, Software, SerialNumber

**Lens**: LensMake, LensModel, LensInfo, LensSpecification, LensSerialNumber

**Exposure**: ExposureTime, FNumber, ExposureProgram, ISO, ExposureCompensation, ShutterSpeedValue, ApertureValue, MaxApertureValue, MeteringMode, Flash, ExposureMode

**Focus**: FocalLength, FocalLengthIn35mmFormat, FocalPlaneXResolution, FocalPlaneYResolution, FocalPlaneResolutionUnit

**Image**: ImageWidth, ImageHeight, Orientation, XResolution, YResolution, ResolutionUnit, ColorSpace, WhiteBalance, CustomRendered, SceneCaptureType

**Date**: DateTimeOriginal, CreateDate, ModifyDate, OffsetTime, OffsetTimeOriginal, OffsetTimeDigitized, SubSecTimeOriginal, SubSecTimeDigitized

**GPS**: GPSLatitude, GPSLongitude, GPSAltitude, GPSLatitudeRef, GPSLongitudeRef, GPSAltitudeRef, GPSTimeStamp, GPSDateStamp, GPSVersionID

### XMP fields extracted

When present, `result.data.xmp` contains:

```typescript
type XmpData = {
  title?: string;       // dc:title
  description?: string; // dc:description
  creator?: string;     // dc:creator
  subject?: string[];   // dc:subject (keywords/tags)
  rating?: number;      // xmp:Rating
  label?: string;       // xmp:Label
  createDate?: string;  // xmp:CreateDate
};
```

XMP is extracted from JPEG (APP1) and PNG (iTXt) automatically.

## Formatted output

Pass `includeFormatted: true` to get human-readable strings for common tags:

```typescript
const result = parseExif(buffer, { includeFormatted: true });
result.data.formattedTags;
// {
//   Shutter: "1/800",
//   Aperture: "f/10",
//   ISO: "ISO 400",
//   FocalLength: "50mm",
//   FocalLengthIn35mmFormat: "75mm",
//   ExposureCompensation: "0 EV",
//   ExposureProgram: "Normal program",
//   MeteringMode: "Multi-segment",
//   Flash: "Off, did not fire",
//   Orientation: "Normal",
//   GPS: "37.7749° N, 122.4194° W",
//   DateTimeOriginal: "Oct 22, 2023, 6:46 PM",
//   Make: "Canon",
//   Model: "EOS R6",
//   LensMake: "Canon",
//   LensModel: "RF50mm F1.2 L USM",
// }
```

### Individual formatters

Available from `inei/format`:

```typescript
import {
  formatShutter,
  formatAperture,
  formatFocalLength,
  formatDate,
  formatOrientation,
  formatExposureCompensation,
  formatExposureProgram,
  formatMeteringMode,
  formatFlash,
  formatGPSCoordinate,
} from "inei/format";

formatShutter(0.00125);            // "1/800"
formatAperture(2.8);               // "f/2.8"
formatFocalLength(50);             // "50mm"
formatDate(1697999167);            // "Oct 22, 2023, 6:46 PM"
formatOrientation(6);              // "Rotated 90° CW"
formatExposureCompensation(-0.7);  // "-0.7 EV"
formatExposureProgram(3);          // "Aperture priority"
formatMeteringMode(5);             // "Multi-segment"
formatFlash(0x10);                 // "Off, did not fire"
formatGPSCoordinate(37.77, -122.42); // "37.77° N, 122.42° W"
```

### Batch formatter

Available from `inei/format-tags`:

```typescript
import { computeFormattedTags } from "inei/format-tags";

const formatted = computeFormattedTags(result.data.tags);
```

### Standalone XMP parser

Available from `inei/xmp`:

```typescript
import { parseXmp } from "inei/xmp";

const data = parseXmp(xmlString);
```

## Export paths

| Path              | Contents                                              |
| ----------------- | ----------------------------------------------------- |
| `inei`            | `parseExif`, `parseExifFromBlob`, `gps`, `orientation`, `thumbnail`, `thumbnailUrl`, `extractThumbnail`, `ExifError`, types |
| `inei/format`     | Individual formatting functions                       |
| `inei/format-tags`| `computeFormattedTags`                                |
| `inei/xmp`        | `parseXmp`, `extractXmpFromApp1`, `extractXmpFromPngITxt` |

## Error handling

`parseExif` never throws. It returns `{ ok: false, error }` on failure.

```typescript
const result = parseExif(buffer);
if (!result.ok) {
  console.error(result.error.code, result.error.message);
}
```

Error codes: `NOT_JPEG`, `NO_EXIF`, `INVALID_TIFF`, `TRUNCATED`, `UNKNOWN`.

The convenience functions (`gps`, `orientation`, `thumbnail`, `thumbnailUrl`) return `undefined` on failure.

## Constraints

- ESM only. No CommonJS support.
- Reads the entire buffer into memory. No chunked or streaming reads.
- IPTC and ICC profile parsing are not supported.
- MakerNote data (vendor-specific extensions) is not decoded.

## License

ISC
