import { createRng, EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { DEFAULT_COURSE } from '../../logic/courses/index.ts';
import type { GameEvent } from '../../logic/events.ts';
import { createWorld } from '../../logic/world.ts';
import { OCEAN_THEME } from '../themes/ocean.ts';
import type { Theme } from '../themes/types.ts';
import { createBursts } from './bursts.ts';
import { createParticleField } from './particles.ts';
import { trailFor } from './trail.ts';

/**
 * Every racer swimming right at a steady 240 px/s for `ticks` ticks of a race drawn in `theme`:
 * the live trail particles left behind and how many racers shed them.
 */
function trailAfter(theme: Theme, ticks: number) {
  const world = createWorld(DEFAULT_COURSE, new EventLog<GameEvent>(), { seed: 1 });
  for (const racer of world.racers) racer.body.vx = 240;
  const back = createParticleField(64);
  const bursts = createBursts(back, createParticleField(8), createRng(1), theme, false);
  const trail = trailFor(theme, world.racers.length, false);
  for (let tick = 0; tick < ticks; tick++) trail?.step(world, bursts);
  return { shed: back.particles.filter((particle) => particle.live), racers: world.racers.length };
}

describe('racer trail', () => {
  it('sheds small white bubbles at 0.6 alpha behind ocean racers, as the race always has', () => {
    const smallWhiteBubble = { frame: 'bubble-small', tint: 0xffffff, alpha: 0.6 };
    expect(OCEAN_THEME.trail).toEqual(smallWhiteBubble);

    const { shed, racers } = trailAfter(OCEAN_THEME, 10);

    // 240 px/s is 4 px a tick, so ten ticks cover 40 px: two particles per racer at 14 px spacing.
    expect(shed.map(({ frame, tint, alpha }) => ({ frame, tint, alpha }))).toEqual(
      Array.from({ length: 2 * racers }, () => smallWhiteBubble),
    );
  });

  it('sheds nothing for a theme without a trail', () => {
    expect(trailFor({ trail: null }, 4, false)).toBeNull();
    expect(trailAfter({ ...OCEAN_THEME, trail: null }, 10).shed).toEqual([]);
  });
});
