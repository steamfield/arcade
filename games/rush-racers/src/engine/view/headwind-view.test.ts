/**
 * How a Headwind front is drawn: its band's span, streaks that blow forward unless motion is reduced,
 * and a fade at each end of its sweep. Read from `headwindLook` on fronts built as the logic leaves them.
 */
import { describe, expect, it } from 'vitest';
import { HEADWIND_SWEEP_TICKS, HEADWIND_TUNING } from '../../logic/powerups/twists/headwind.ts';
import { TILE, type Twist } from '../../logic/types.ts';
import { headwindLook } from './headwind-view.ts';

/** A Headwind front centred on x = 400 that has swept for `swept` ticks. */
const front = (swept: number): Twist => ({
  style: 'headwind',
  owner: 'player',
  x: 400,
  y: 120,
  vx: HEADWIND_TUNING.speed,
  vy: 0,
  ttl: HEADWIND_SWEEP_TICKS - swept,
  phase: 0,
});

describe('how a Headwind front looks', () => {
  it('spans the front its width either side of its centre', () => {
    const halfWidth = (HEADWIND_TUNING.widthTiles * TILE) / 2;
    expect(headwindLook(front(40), false)).toMatchObject({ left: 400 - halfWidth, right: 400 + halfWidth });
  });

  it('blows its streaks forward as it sweeps, and holds them still with reduced motion', () => {
    const drifts = [40, 41, 42].map((swept) => headwindLook(front(swept), false).driftPx);
    expect(drifts[1]).toBeGreaterThan(drifts[0] ?? 0);
    expect(drifts[2]).toBeGreaterThan(drifts[1] ?? 0);
    expect([40, 41, 42].map((swept) => headwindLook(front(swept), true).driftPx)).toEqual([0, 0, 0]);
  });

  it('fades in as it starts and out as its sweep ends, fully shown between', () => {
    const alphas = [0, 4, 40, HEADWIND_SWEEP_TICKS - 10, HEADWIND_SWEEP_TICKS].map(
      (swept) => headwindLook(front(swept), false).alpha,
    );
    expect(alphas).toEqual([0, 0.5, 1, 0.5, 0]);
  });
});
