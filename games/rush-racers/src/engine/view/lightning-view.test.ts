import { describe, expect, it } from 'vitest';
import { LIGHTNING } from '../../logic/hazards/tuning.ts';
import { TILE } from '../../logic/types.ts';
import { stormLook, zoneSide } from './lightning-view.ts';

describe('how a storm zone looks through its cycle', () => {
  it('shows nothing while calm', () => {
    expect(stormLook('calm', 30, false)).toEqual({
      shadeAlpha: 0,
      shimmerAlpha: 0,
      cloudAlpha: 0,
      boltVisible: false,
      boltFlipped: false,
    });
  });

  it('darkens and shimmers more as the warning goes on, with no bolt yet', () => {
    const early = stormLook('warning', 0, false);
    const late = stormLook('warning', LIGHTNING.warnTicks - 1, false);
    expect(early.shadeAlpha).toBeGreaterThan(0);
    expect(early.shimmerAlpha).toBeGreaterThan(0);
    expect(late.shadeAlpha).toBeGreaterThan(early.shadeAlpha);
    expect(late.cloudAlpha).toBeGreaterThan(early.cloudAlpha);
    expect(late.boltVisible).toBe(false);
  });

  it('shows a bolt that crackles during a strike, and a still one under reduced motion', () => {
    const beats = Array.from({ length: LIGHTNING.strikeTicks }, (_, tick) => stormLook('strike', tick, false));
    expect(beats.every((look) => look.boltVisible)).toBe(true);
    expect(new Set(beats.map((look) => look.boltFlipped))).toEqual(new Set([true, false]));
    const still = Array.from({ length: LIGHTNING.strikeTicks }, (_, tick) => stormLook('strike', tick, true));
    expect(still.every((look) => look.boltVisible && !look.boltFlipped)).toBe(true);
  });
});

describe('where a storm zone sits across from the camera', () => {
  // A 320 px view from x = 1600 to 1920 (tile columns 100-119).
  const view = { x: 100 * TILE, width: 320 };
  const zone = (from: number, to: number) => ({
    cols: [from, to] as [number, number],
    periodTicks: 150,
    offsetTicks: 0,
  });

  it('is on screen when any column is in view, even one at either edge', () => {
    expect(zoneSide(zone(105, 109), view)).toBe('on screen');
    expect(zoneSide(zone(95, 100), view)).toBe('on screen');
    expect(zoneSide(zone(119, 123), view)).toBe('on screen');
  });

  it('is beside the edge it is just past, up to a screen width away', () => {
    expect(zoneSide(zone(120, 124), view)).toBe('right');
    expect(zoneSide(zone(140, 144), view)).toBe('right');
    expect(zoneSide(zone(95, 99), view)).toBe('left');
    expect(zoneSide(zone(76, 79), view)).toBe('left');
  });

  it('is far once more than a screen width beyond either edge', () => {
    expect(zoneSide(zone(141, 145), view)).toBe('far');
    expect(zoneSide(zone(70, 78), view)).toBe('far');
  });
});
