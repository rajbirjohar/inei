import { describe, expect, it } from 'vitest';
import { parseExif } from '../src/index';
import {
  buildJpegWithExifAndSize,
  buildTiffLE_IFD0,
} from './utils/jpeg-builder';

describe('integration: parseExif', () => {
  it('reads image size and basic IFD0 tags', () => {
    const app1 = buildTiffLE_IFD0({
      make: 'Canon',
      model: 'UnitCam',
      xres: [240, 1],
      yres: [240, 1],
    });
    const jpeg = buildJpegWithExifAndSize(app1, { width: 1234, height: 567 });

    const res = parseExif(jpeg);
    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }

    const { image, tags } = res.data;
    expect(image).toEqual({ width: 1234, height: 567 });
    expect(tags.Make).toBe('Canon');
    expect(tags.Model).toBe('UnitCam');
    expect(tags.XResolution).toBe(240);
    expect(tags.YResolution).toBe(240);
  });
});
