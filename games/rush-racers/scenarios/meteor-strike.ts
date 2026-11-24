/**
 * Cloudreach's Cannonball is the Meteor: fired on Sky Test with a rival leading, it marks that
 * rival, shadows them, then falls and ends on the cloud it lands on.
 */
import { expect } from '@playwright/test';
import { HARD_SAVE, hold, scenario, tap, wait } from './kit.ts';

/** Ticks the player waits in the tunnel after GO, long enough for the rivals to fly past it. */
const LET_THEM_PASS = 420;

/** Ticks after firing: the meteor's 60-tick warning, then its fall. */
const WATCH_IT_FALL = 120;

/**
 * The `cannonball` stage hands the player a Cannonball in the low tunnel, far ahead of the grid.
 * The player waits there while the rivals fly past, fires it, then follows them, dashing through the
 * tunnel's puff cloud plug. Cloudreach's Cannonball marks the
 * leader, a rival, with a warning, never the player itself; the rivals hold their line, so it falls
 * on the marked rival and ends on the cloud below.
 */
export default scenario({
  description: 'the Meteor marks the leading rival, warns, falls and ends where it lands',
  // Hard lets rivals be attacked and gives nobody a catch-up boost, so the rivals pass at their own pace.
  start: { save: HARD_SAVE, seed: 1, query: { course: 'sky-test', stage: 'cannonball' } },
  input: [
    // Sky Test is unlisted, so Race skips course select: title Race, then race as the saved pick.
    wait(25),
    tap('fire'),
    wait(25),
    tap('fire'),
    wait(180),
    wait(LET_THEM_PASS),
    tap('fire'),
    // Follow under the block so the meteor's shadow and fall are on screen.
    hold('right', 30),
    hold(['right', 'dash'], 1),
    hold('right', WATCH_IT_FALL - 31),
  ],
  expect({ events }) {
    expect(events.filter((e) => e.type === 'item.used' && e.id === 'player')).toMatchObject([
      { kind: 'cannonball', chargesLeft: 0 },
    ]);
    const shots = events.filter(
      (e) => e.type === 'shot.launched' || e.type === 'shot.warned' || e.type === 'shot.ended',
    );
    expect(shots.map((e) => e.type)).toEqual(['shot.launched', 'shot.warned', 'shot.ended']);
    const launched = events.find((e) => e.type === 'shot.launched');
    const target = launched?.target;
    expect(launched).toMatchObject({ owner: 'player', style: 'meteor' });
    expect(['tess', 'squib', 'bo'], 'it marks a rival').toContain(target);
    expect(events.find((e) => e.type === 'shot.warned')).toMatchObject({ owner: 'player', target });
    const ended = events.find((e) => e.type === 'shot.ended');
    expect((ended?.tick ?? 0) - (launched?.tick ?? 0), 'it falls after its whole warning').toBeGreaterThan(60);
    const struck = events.filter((e) => e.type === 'racer.hit' && e.cause === 'meteor').map((e) => e.id);
    expect(struck, 'it lands on the rival it marked').toContain(target);
    expect(struck, 'never on the player who fired it').not.toContain('player');
  },
});
