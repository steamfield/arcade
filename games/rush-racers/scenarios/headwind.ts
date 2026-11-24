/**
 * Cloudreach's Undertow is the Headwind: fired on Sky Test behind the rivals, a gust front sweeps
 * forward over them for 30 tiles and dies away, never touching the player who fired it.
 */
import { expect } from '@playwright/test';
import { HARD_SAVE, hold, scenario, tap, wait } from './kit.ts';

/** Ticks the player waits on the grid after GO, so the rivals are a few tiles ahead when it fires. */
const LET_THEM_LEAD = 60;

/** Ticks the player follows the front after firing: its 144-tick sweep and a little more. */
const FOLLOW_THE_FRONT = 160;

/** Tiles the front sweeps before it dies away. */
const SWEEP_TILES = 30;

const TILE = 16;

/**
 * The `icons-c` stage hands the player one Headwind on the grid. The player waits while the rivals
 * fly off, fires it, then flies after the front, which sweeps over the rivals ahead.
 */
export default scenario({
  description: 'the Headwind sweeps a gust front 30 tiles forward from the player and dies away',
  // Hard lets the player's front hold back every rival and gives nobody a catch-up boost.
  start: { save: HARD_SAVE, seed: 1, query: { course: 'sky-test', stage: 'icons-c' } },
  input: [
    // Sky Test is unlisted, so Race skips course select: title Race, then race as the saved pick.
    wait(25),
    tap('fire'),
    wait(25),
    tap('fire'),
    wait(180),
    wait(LET_THEM_LEAD),
    tap('fire'),
    hold('right', FOLLOW_THE_FRONT),
  ],
  expect({ events }) {
    expect(events.filter((e) => e.type === 'item.used' && e.id === 'player')).toMatchObject([
      { kind: 'undertow', chargesLeft: 0 },
    ]);
    expect(
      events.filter((e) => e.type === 'undertow.fired' && e.id === 'player'),
      'the world twist replaces the shared Undertow',
    ).toEqual([]);
    const fronts = events.filter(
      (e) => (e.type === 'twist.launched' || e.type === 'twist.ended') && e.owner === 'player',
    );
    expect(fronts.map((e) => e.type)).toEqual(['twist.launched', 'twist.ended']);
    expect(fronts[0]).toMatchObject({ style: 'headwind' });
    const used = events.find((e) => e.type === 'item.used' && e.id === 'player');
    const ended = fronts[1];
    expect((ended?.tick ?? 0) - (used?.tick ?? 0), 'it sweeps for 144 ticks').toBe(143);
    expect(Number(ended?.x) / TILE, 'it sweeps 30 tiles from the grid').toBeGreaterThan(SWEEP_TILES);
  },
});
