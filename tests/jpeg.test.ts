import { expect, it } from 'vitest';
import { ByteStream } from '../src/byte-stream';
import { isSOF, readSections, readSizeFromSOF } from '../src/jpeg';
import { be16 } from './utils/jpeg-builder';

function concat(...parts: Uint8Array[]) {
  const len = parts.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

it('readSections walks non-APP1 then APP1 then SOF', () => {
  const SOI = new Uint8Array([0xff, 0xd8]);
  const DQT = concat(
    new Uint8Array([0xff, 0xdb]),
    be16(4),
    new Uint8Array([1, 2])
  ); // minimal
  const APP1 = concat(
    new Uint8Array([0xff, 0xe1]),
    be16(2),
    new Uint8Array([])
  );
  const sofBody = concat(
    new Uint8Array([8]),
    be16(10),
    be16(20),
    new Uint8Array([1]),
    new Uint8Array([1, 0x11, 0])
  );
  const SOF0 = concat(
    new Uint8Array([0xff, 0xc0]),
    be16(2 + sofBody.length),
    sofBody
  );
  const EOI = new Uint8Array([0xff, 0xd9]);

  const jpeg = concat(SOI, DQT, APP1, SOF0, EOI);
  const s = new ByteStream(jpeg, 'BE'); // endianness irrelevant for marker walk

  const seen: number[] = [];
  readSections(s, (marker, section) => {
    seen.push(marker);
    if (isSOF(marker)) {
      const size = readSizeFromSOF(section);
      expect(size).toEqual({ width: 20, height: 10 });
    }
  });

  expect(seen).toContain(0xdb); // DQT
  expect(seen).toContain(0xe1); // APP1
  expect(seen).toContain(0xc0); // SOF0
});
