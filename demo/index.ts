/** biome-ignore-all lint/suspicious/noConsole: Demo script */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatAperture,
  formatExposureProgram,
  formatShutter,
} from '../src/format.js';
// Import your lib directly from source for dev runs:
import { parseExif } from '../src/index.js';
import { extractThumbnail } from '../src/thumbnail.js';

type Flags = {
  verbose: boolean;
  help: boolean;
};

function parseArgs(argv: string[]) {
  const flags: Flags = { verbose: false, help: false };
  const files: string[] = [];

  for (const a of argv) {
    if (a === '-v' || a === '--verbose') {
      flags.verbose = true;
    } else if (a === '-h' || a === '--help') {
      flags.help = true;
    } else {
      files.push(a);
    }
  }

  const file = files[0];
  return { flags, file };
}

function usage() {
  console.log(`Usage: tsx demo/demo.ts <image> [--verbose]

Options:
  -v, --verbose   Print all parsed tags and derived values
  -h, --help      Show this help
`);
}

function toHexPreview(u8: Uint8Array, max = 32): string {
  const n = Math.min(u8.length, max);
  const hex = Array.from(u8.subarray(0, n))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
  return `Uint8Array(${u8.length}) ${hex}${u8.length > n ? ' …' : ''}`;
}

function pretty(v: unknown): unknown {
  if (v instanceof Uint8Array) {
    return toHexPreview(v);
  }
  // let arrays print naturally
  if (Array.isArray(v)) {
    return v;
  }
  return v;
}

function main() {
  const { flags, file } = parseArgs(process.argv.slice(2));
  if (flags.help || !file) {
    usage();
    // Provide a default demo file if run without args
    if (!file) {
      const here = dirname(fileURLToPath(import.meta.url));
      const fallback = resolve(here, 'fixtures/photo.jpg');
      console.log('No file provided; trying:', fallback, '\n');
      return runOnce(fallback, flags);
    }
    return;
  }
  return runOnce(file, flags);
}

async function runOnce(path: string, flags: Flags) {
  const buf = await readFile(path);
  const res = parseExif(buf);

  if (!res.ok) {
    console.error('Parse error:', res.error);
    process.exitCode = 1;
    return;
  }

  const { image, tags, thumbnail } = res.data;
  const t = tags;

  // Summary (always shown)
  console.log('Image:', image ?? '(unknown)');
  console.log('Camera:', t.Make, t.Model);
  console.log('ISO:', t.ISO);
  console.log('Lens:', t.LensModel ?? t.LensInfo);

  // Derived niceties
  const shutter = formatShutter(t.ExposureTime);
  const aperture = formatAperture(t.FNumber);
  const program = formatExposureProgram(t.ExposureProgram);
  const dt =
    typeof t.DateTimeOriginal === 'number'
      ? new Date(t.DateTimeOriginal * 1000).toISOString()
      : undefined;

  console.log('Exposure:', {
    shutter,
    aperture,
    program,
    focal: t.FocalLength ? `${t.FocalLength}mm` : undefined,
    comp: t.ExposureCompensation,
  });
  console.log('Captured:', dt);
  console.log('Thumbnail:', thumbnail ? { ...thumbnail } : 'none');

  if (flags.verbose) {
    console.log('\n— All Tags —');
    const keys = Object.keys(t).sort((a, b) => a.localeCompare(b));
    for (const k of keys) {
      console.log(`${k}:`, pretty(t[k]));
    }

    // Optional: show a tiny preview of thumbnail bytes
    if (thumbnail) {
      const thumb = extractThumbnail(buf, res.data);
      if (thumb) {
        console.log('\n— Thumbnail Bytes —');
        console.log(toHexPreview(thumb, 64));
      }
    }
  }
}

main()?.catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
