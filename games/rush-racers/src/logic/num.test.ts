import { describe, expect, it } from 'vitest';
import { cos, length, sin } from './num.ts';

describe('engine-independent math', () => {
  it('matches Math.sin and Math.cos closely across many turns', () => {
    for (let i = -2000; i <= 2000; i++) {
      const rad = i * 0.0137;
      expect(Math.abs(sin(rad) - Math.sin(rad))).toBeLessThan(1e-9);
      expect(Math.abs(cos(rad) - Math.cos(rad))).toBeLessThan(1e-9);
    }
  });

  it('hits the quarter turns', () => {
    expect(sin(0)).toBe(0);
    expect(sin(Math.PI / 2)).toBeCloseTo(1, 12);
    expect(cos(Math.PI)).toBeCloseTo(-1, 12);
  });

  it('measures vector length exactly for whole numbers', () => {
    expect(length(3, 4)).toBe(5);
    expect(length(0, 0)).toBe(0);
  });
});
