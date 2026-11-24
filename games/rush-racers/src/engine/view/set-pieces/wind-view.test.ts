import { describe, expect, it } from 'vitest';
import { SHIFTING_WIND } from '../../../logic/setpieces/shifting-wind.ts';
import type { ShiftingWindDef } from '../../../logic/types.ts';
import { windLook } from './wind-view.ts';

/** +x on race ticks 0-119, -x on 120-239; warnings from 60 and from 180. */
const ZONE: ShiftingWindDef = { cols: [10, 14], periodTicks: 240, offsetTicks: 0, push: 70 };
const TURN = 120;

describe('how a shifting wind zone looks', () => {
  it('streaks drift downwind with the windsock pointing the same way between warnings', () => {
    const blowingRight = windLook(ZONE, 10);
    expect(blowingRight).toMatchObject({ dir: 1, sockLean: 1 });
    expect(blowingRight.driftPx).toBeGreaterThan(0);
    const blowingLeft = windLook(ZONE, TURN + 10);
    expect(blowingLeft).toMatchObject({ dir: -1, sockLean: -1 });
    expect(blowingLeft.driftPx).toBeLessThan(0);
  });

  it('swings the windsock across to the coming direction through the warning, hanging straight halfway', () => {
    const warnFrom = TURN - SHIFTING_WIND.warnTicks;
    const leans = [warnFrom, warnFrom + SHIFTING_WIND.warnTicks / 2, TURN - 1, TURN].map(
      (tick) => windLook(ZONE, tick).sockLean,
    );
    expect(leans.map((lean) => Math.round(lean * 100) / 100)).toEqual([1, 0, -0.97, -1]);
  });

  it('fades its streaks during a warning', () => {
    expect(windLook(ZONE, TURN - 10).streakAlpha).toBeLessThan(windLook(ZONE, 10).streakAlpha);
  });
});
