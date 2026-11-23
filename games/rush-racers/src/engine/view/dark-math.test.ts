import { describe, expect, it } from 'vitest';
import {
  FADE,
  FLICKER_PX,
  FLICKER_TICKS,
  fadeSteps,
  flicker,
  LIGHT_RADIUS,
  leadOffset,
  lightOpacity,
  lightRadius,
  mergeZones,
  reachableRadii,
  type Span,
  spansOnScreen,
} from './dark-math.ts';

describe('the light pool flicker', () => {
  it('never flickers under reduced motion', () => {
    for (let tick = 0; tick < 600; tick++) {
      for (let index = 0; index < 4; index++) expect(flicker(tick, index, true)).toBe(0);
    }
  });

  it('changes only on multiples of 20 ticks and stays within 0..2 px', () => {
    const seen = new Set<number>();
    for (let index = 0; index < 4; index++) {
      for (let tick = 1; tick < 600; tick++) {
        const now = flicker(tick, index, false);
        seen.add(now);
        expect(now).toBeGreaterThanOrEqual(0);
        expect(now).toBeLessThanOrEqual(FLICKER_PX);
        if (tick % FLICKER_TICKS !== 0)
          expect(now, `racer ${index} at tick ${tick}`).toBe(flicker(tick - 1, index, false));
      }
    }
    // It does flicker in normal motion.
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('light reach', () => {
  it('gives the player the widest pool and adds the lantern bonus to anyone holding one', () => {
    expect(lightRadius(true, false)).toBe(LIGHT_RADIUS.player);
    expect(lightRadius(false, false)).toBe(LIGHT_RADIUS.rival);
    expect(lightRadius(true, true)).toBe(LIGHT_RADIUS.player + LIGHT_RADIUS.lanternBonus);
    expect(lightRadius(false, true)).toBe(LIGHT_RADIUS.rival + LIGHT_RADIUS.lanternBonus);
  });

  it('lists every radius a pool can be drawn at, flicker included', () => {
    const radii = reachableRadii();
    for (const isPlayer of [true, false]) {
      for (const lantern of [true, false]) {
        for (let tick = 0; tick < 400; tick++) {
          expect(radii).toContain(lightRadius(isPlayer, lantern) - flicker(tick, isPlayer ? 0 : 2, false));
        }
      }
    }
  });

  it('lights fully inside, fades over the edge rings and stops at the radius', () => {
    expect([0, 47, 50, 54, 58, 62, 64, 70].map((d) => lightOpacity(d, 64))).toEqual([1, 1, 1, 0.75, 0.5, 0.25, 0, 0]);
  });

  it('lets the player see a hazard at least 0.3 s ahead at top speed', () => {
    const topSpeed = 180;
    // The clear core starts one full ring set in from the radius; the lead pushes it forward.
    const clearAhead = LIGHT_RADIUS.player - 4 * 4 + leadOffset(topSpeed);
    expect(clearAhead / topSpeed).toBeGreaterThanOrEqual(0.3);
  });

  it('leads along the velocity, capped at 16 px each way', () => {
    expect([0, 50, -50, 180, -180].map(leadOffset)).toEqual([0, 6, -6, 16, -16]);
  });
});

describe('dark zones on screen', () => {
  it('merges overlapping and touching ranges once', () => {
    expect(
      mergeZones([
        [30, 40],
        [10, 20],
        [21, 25],
        [35, 50],
        [60, 61],
      ]),
    ).toEqual([
      [10, 25],
      [30, 50],
      [60, 61],
    ]);
  });

  it('drops zones outside the 320 px screen and keeps the rest in screen px', () => {
    const out: Span[] = [];
    // Screen covers world x 160-479, tiles 10-29.
    const zones = [
      [0, 9],
      [8, 12],
      [20, 25],
      [30, 40],
    ] as const;
    const count = spansOnScreen(zones, 160, 320, out);
    expect(out.slice(0, count)).toEqual([
      { left: -32, right: 48 },
      { left: 160, right: 256 },
    ]);
  });

  it('reuses the spans array between frames', () => {
    const out: Span[] = [];
    spansOnScreen([[0, 3]], 0, 320, out);
    const first = out[0];
    expect(spansOnScreen([[1, 3]], 0, 320, out)).toBe(1);
    expect(out[0]).toBe(first);
    expect(out[0]).toEqual({ left: 16, right: 64 });
  });

  it('fits the fade to a narrow zone', () => {
    expect(fadeSteps(29 * 16)).toBe(FADE.steps);
    expect(fadeSteps(64)).toBe(4);
    expect(fadeSteps(48)).toBe(3);
    expect(fadeSteps(16)).toBe(1);
    expect(fadeSteps(8)).toBe(0);
  });
});
