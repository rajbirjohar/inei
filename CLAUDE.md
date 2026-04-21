# inei

EXIF and XMP metadata parser for JPEG, PNG, and HEIC/HEIF/AVIF. TypeScript. Zero dependencies. Browser + Node.js.

## Commands

```bash
pnpm test            # Run tests (vitest)
pnpm test:watch      # Watch mode
pnpm test:coverage   # Coverage report (thresholds enforced)
pnpm typecheck       # tsc --noEmit
pnpm lint            # ultracite check (biome)
pnpm format          # ultracite fix (biome)
pnpm build           # vite build + tsc declarations
pnpm demo            # Run demo with tsx
```

## Architecture

The library has three layers:

1. **Container parsers** read the image container format to find raw EXIF/XMP data:
   - `jpeg.ts` — walks JPEG segments (APP1 for EXIF/XMP, SOF for dimensions)
   - `png.ts` — walks PNG chunks (eXIf for EXIF, iTXt for XMP, IHDR for dimensions)
   - `heic.ts` — walks ISOBMFF boxes (meta/iinf/iloc for EXIF and XMP, ispe for dimensions)

2. **TIFF/IFD parser** (`exif-sections.ts`) reads the EXIF data structure, which is the same TIFF IFD format regardless of container. Two entry points:
   - `readIFDs()` — for JPEG APP1 payloads (has "Exif\0\0" prefix)
   - `readTiffIFDs()` — for raw TIFF bytes (PNG eXIf and HEIC provide this directly)

3. **Orchestrator** (`parser.ts`) auto-detects format via `detect.ts`, delegates to the right container parser, post-processes tags (simplify rationals, cast GPS to decimal degrees, cast dates to epoch seconds, apply timezone offsets), and optionally runs `format-tags.ts` for human-readable strings.

## Export paths

| Import | File | Contains |
|---|---|---|
| `inei` | `src/index.ts` | `parseExif`, `parseExifFromBlob`, `gps`, `orientation`, `thumbnail`, `thumbnailUrl`, `extractThumbnail`, `ExifError`, all types |
| `inei/format` | `src/format.ts` | `formatShutter`, `formatAperture`, `formatFocalLength`, `formatDate`, `formatOrientation`, `formatExposureCompensation`, `formatExposureProgram`, `formatMeteringMode`, `formatFlash`, `formatGPSCoordinate` |
| `inei/format-tags` | `src/format-tags.ts` | `computeFormattedTags` |
| `inei/xmp` | `src/xmp.ts` | `parseXmp`, `extractXmpFromApp1`, `extractXmpFromPngITxt`, `isXmpApp1` |

## Key types

```typescript
// Result is a discriminated union — never throws
type Result = { ok: true; data: ParsedExif } | { ok: false; error: ExifError };

interface ParsedExif {
  image?: { width: number; height: number };
  tags: Partial<ExifTagMap>;           // simplified values
  tagsRaw: Record<string, unknown>;    // raw values before simplification
  thumbnail?: ThumbnailInfo;
  formattedTags?: Record<string, string>;  // only with includeFormatted: true
  xmp?: XmpData;                       // only when XMP metadata exists
}

// ExifTagMap has typed keys for common tags (Make, Model, ISO, FNumber, etc.)
// Unknown tags appear as "tag_0x{hex}" in the index signature.

interface XmpData {
  title?: string;        // dc:title
  description?: string;  // dc:description
  creator?: string;      // dc:creator
  subject?: string[];    // dc:subject (keywords)
  rating?: number;       // xmp:Rating
  label?: string;        // xmp:Label
  createDate?: string;   // xmp:CreateDate
}
```

## Value simplification (on by default)

- Rationals `[num, den]` become `num / den` (float)
- Dates `"2023:10:22 18:46:07"` become epoch seconds (`1697999167`)
- GPS DMS arrays become decimal degrees (`37.7749`)
- Timezone offsets (OffsetTime*) are applied to date values

## Conventions

- ESM only. No CommonJS.
- Strict TypeScript (strict, noUncheckedIndexedAccess).
- Biome for linting/formatting (via ultracite). Double quotes, interface over type alias.
- Tests in `tests/` directory, using vitest.
- Binary parsing uses `ByteStream` (`src/byte-stream.ts`) — bounds-checked, endian-aware, zero-copy branching.
- Bitwise operations in `heic.ts` are suppressed via biome-ignore (required for ISOBMFF parsing).
- Changesets for versioning. Run `pnpm changeset` before publishing.
