import type { ByteStream } from "./byte-stream";
import type { ImageSize } from "./types";

/**
 * @module png
 * PNG chunk reader. Walks the chunk stream to find eXIf and IHDR chunks.
 *
 * PNG structure:
 *   8-byte signature → chunks (4-byte length, 4-byte type, data, 4-byte CRC)
 *
 * The eXIf chunk (PNG 1.5, registered 2017) contains raw TIFF bytes —
 * identical to JPEG APP1 Exif data but WITHOUT the "Exif\0\0" prefix.
 * It starts directly with the TIFF header (II/MM + magic 42 + IFD0 offset).
 */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Verify the 8-byte PNG signature. */
export function isPNG(stream: ByteStream): boolean {
  if (stream.size() < 8) {
    return false;
  }
  const s = stream.branch(0);
  for (const expected of PNG_SIGNATURE) {
    if (s.u8() !== expected) {
      return false;
    }
  }
  return true;
}

export type PngChunkVisitor = (
  type: string,
  data: ByteStream,
  offset: number
) => void;

/**
 * Walk PNG chunks, calling visitor for each.
 * Stops after IEND or when bytes run out.
 */
export function readPngChunks(
  stream: ByteStream,
  visitor: PngChunkVisitor
): void {
  const s = stream.branch(0);
  s.setEndian("BE");
  s.skip(8); // skip signature

  while (s.remaining() >= 12) {
    const length = s.u32();
    const typeBytes = s.readString(4);
    const dataStart = s.tell();

    if (length > s.remaining()) {
      break; // truncated
    }

    const data = s.branch(dataStart, length);
    visitor(typeBytes, data, dataStart);

    s.skip(length); // skip data
    s.skip(4); // skip CRC

    if (typeBytes === "IEND") {
      break;
    }
  }
}

/**
 * Extract the raw TIFF bytes from a PNG eXIf chunk.
 * Returns a ByteStream positioned at the TIFF header, or undefined.
 */
export function findExifChunk(stream: ByteStream): ByteStream | undefined {
  let result: ByteStream | undefined;
  readPngChunks(stream, (type, data) => {
    if (type === "eXIf" && !result) {
      result = data;
    }
  });
  return result;
}

/**
 * Read image dimensions from the IHDR chunk.
 */
export function readPngSize(stream: ByteStream): ImageSize | undefined {
  let result: ImageSize | undefined;
  readPngChunks(stream, (type, data) => {
    if (type === "IHDR" && !result) {
      data.setEndian("BE");
      const width = data.u32();
      const height = data.u32();
      result = { width, height };
    }
  });
  return result;
}
