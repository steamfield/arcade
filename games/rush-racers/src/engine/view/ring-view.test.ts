import { describe, expect, it } from 'vitest';
import { RingFrame, ringLook, SPARKLE_TICKS } from './ring-view.ts';

describe('how a boost ring looks to the local racer', () => {
  it('is gold and full size before the local racer passes it', () => {
    expect(ringLook(false, null, 0, 0, false)).toMatchObject({ frame: RingFrame.ready, scale: 1, alpha: 1 });
  });

  it('swells gold on a pass, eases back, then looks spent', () => {
    const start = ringLook(true, 0, 100, 0, false);
    const middle = ringLook(true, SPARKLE_TICKS / 2, 100, 0, false);
    const after = ringLook(true, SPARKLE_TICKS, 100, 0, false);
    expect(start.frame).toBe(RingFrame.ready);
    expect(start.scale).toBeGreaterThan(middle.scale);
    expect(middle.scale).toBeGreaterThan(1);
    expect(after).toMatchObject({ frame: RingFrame.spent, scale: 1 });
    expect(after.alpha).toBeLessThan(1);
  });

  it('looks spent at once for a pass this screen did not see', () => {
    expect(ringLook(true, null, 100, 0, false).frame).toBe(RingFrame.spent);
  });

  it('bobs, and holds still with no swell under reduced motion', () => {
    const bobs = Array.from({ length: 90 }, (_, tick) => ringLook(false, null, tick, 0, false).bob);
    expect(new Set(bobs).size).toBeGreaterThan(1);
    for (let tick = 0; tick < 90; tick++) expect(ringLook(false, null, tick, 0, true).bob).toBe(0);
    expect(ringLook(true, 0, 100, 0, true)).toMatchObject({ frame: RingFrame.spent, scale: 1 });
  });
});
