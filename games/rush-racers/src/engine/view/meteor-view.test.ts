import { describe, expect, it } from 'vitest';
import { METEOR_TUNING } from '../../logic/powerups/cannonball/meteor.ts';
import { type Shot, TILE } from '../../logic/types.ts';
import { meteorLook } from './meteor-view.ts';

/** The ground the meteor lands on, px. */
const GROUND_Y = 20 * TILE;

/** A meteor shot over x = 100 with `phase` warning ticks left, at height `y`. */
const shot = (phase: number, y: number): Shot => ({
  style: 'meteor',
  owner: 'player',
  x: 100,
  y,
  vx: 0,
  vy: phase === 0 ? METEOR_TUNING.fallSpeed : 0,
  ttl: 300,
  target: 'tess',
  phase,
});

describe('how a meteor looks', () => {
  it('shows only a shadow on the ground while it warns, growing as the fall nears', () => {
    const early = meteorLook(shot(METEOR_TUNING.warnTicks, GROUND_Y - TILE), GROUND_Y);
    const late = meteorLook(shot(1, GROUND_Y - TILE), GROUND_Y);
    expect(early.meteor).toBeNull();
    expect(late.meteor).toBeNull();
    expect(early.shadow).toMatchObject({ x: 100, y: GROUND_Y });
    expect(late.shadow.radius).toBeGreaterThan(early.shadow.radius);
    expect(late.shadow.alpha).toBeGreaterThan(early.shadow.alpha);
  });

  it('draws the falling meteor with a trail, its shadow full size as it lands', () => {
    const high = meteorLook(shot(0, TILE), GROUND_Y);
    const low = meteorLook(shot(0, GROUND_Y), GROUND_Y);
    expect(high.meteor).toMatchObject({ x: 100, y: TILE });
    expect(high.meteor?.trailPx).toBeGreaterThan(0);
    expect(low.shadow.radius).toBe(1.5 * TILE);
    expect(high.shadow.radius).toBeLessThan(low.shadow.radius);
    expect(high.shadow.radius).toBeGreaterThanOrEqual(meteorLook(shot(1, TILE), GROUND_Y).shadow.radius);
  });
});
