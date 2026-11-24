import { describe, expect, it } from 'vitest';
import { approach, clamp, cos, length, sin, unit } from './num.ts';

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

describe('vector and scalar helpers', () => {
  it('scales a vector to length 1 and leaves a zero vector at zero', () => {
    expect(unit({ x: 3, y: -4 })).toEqual({ x: 0.6, y: -0.8 });
    expect(unit({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('clamps below, inside and above the range', () => {
    expect([clamp(-5, -2, 2), clamp(1.5, -2, 2), clamp(9, -2, 2)]).toEqual([-2, 1.5, 2]);
  });

  it('approaches a target by at most the step from either side, never overshooting', () => {
    expect([approach(0, 10, 3), approach(10, 0, 3), approach(9, 10, 3), approach(1, 0, 3)]).toEqual([3, 7, 10, 0]);
  });
});
