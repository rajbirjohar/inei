import { describe, expect, it } from 'vitest';
import {
  formatAperture,
  formatExposureProgram,
  formatShutter,
} from '../src/format';

describe('format helpers', () => {
  it('formatShutter', () => {
    expect(formatShutter(0.00025)).toBe('1/4000');
    expect(formatShutter(0.5)).toBe('1/2');
    expect(formatShutter(2)).toBe('2s');
    expect(formatShutter(undefined)).toBeUndefined();
  });
  it('formatAperture', () => {
    expect(formatAperture(1.8)).toBe('f/1.8');
    expect(formatAperture(undefined)).toBeUndefined();
  });
  it('formatExposureProgram', () => {
    expect(formatExposureProgram(2)).toMatch('Normal program');
    expect(formatExposureProgram(undefined)).toBeUndefined();
  });
});
