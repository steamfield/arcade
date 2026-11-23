/**
 * A runner stomps a beetle on Run Test: landing on an enemy from above beats it and bounces the
 * runner back up, where touching it from the side would have been a hit.
 */
import { expect } from '@playwright/test';
import { HARD_SAVE, hold, scenario, tap, wait } from './kit.ts';

/** Easy, so the hop below is timed on Easy's rivals and the boar never winds up on the player; pinned so a new default can't move it. */
const EASY_SAVE = {
  ...HARD_SAVE,
  data: { ...HARD_SAVE.data, settings: { ...HARD_SAVE.data.settings, difficulty: 'easy' } },
};

/** Top of Run Test's floor (row 9), in px. A runner standing on it has its bottom here. */
const FLOOR_TOP = 144;

/** Half a tile, in px: how far above the floor the runner must still be to count as bounced. */
const HALF_TILE = 8;

/**
 * The `enemies` stage puts a beetle on the floor 3 tiles ahead of the player, walking away, and lifts
 * the rivals clear (on foot they drop back down behind the player). From GO, a short hop (Up for 8
 * ticks) and a dash in the air carry the runner over the beetle; it comes down on the beetle's back
 * 12 ticks later, well before a rival can reach it. Seven ticks after the stomp the runner is still
 * in the air from the bounce, where a runner that simply landed would be back on the floor.
 */
export default scenario({
  description: 'landing on a beetle from above stomps it and bounces the runner back up',
  start: { save: EASY_SAVE, seed: 1, query: { course: 'run-test', stage: 'enemies' } },
  input: [
    // Run Test is unlisted, so Race skips course select: title Race, then race as the saved pick.
    wait(25),
    tap('fire'),
    wait(25),
    tap('fire'),
    wait(180),
    hold(['right', 'up'], 8),
    hold(['right', 'dash'], 1),
    hold('right', 18),
  ],
  expect({ events, state }) {
    expect(events.filter((e) => e.type === 'enemy.bonked' && e.by === 'player')).toMatchObject([
      { kind: 'crab', how: 'stomp', hpLeft: 0 },
    ]);
    expect(events.filter((e) => e.type === 'enemy.defeated' && e.by === 'player')).toMatchObject([{ kind: 'crab' }]);
    expect(events.filter((e) => e.type === 'racer.hit' && e.id === 'player')).toEqual([]);
    const { racers } = state as { racers: { id: string; body: { y: number; h: number } }[] };
    const player = racers.find((racer) => racer.id === 'player');
    expect(player, 'the player racer is in the state').toBeDefined();
    const bottom = (player?.body.y ?? FLOOR_TOP) + (player?.body.h ?? 0);
    expect(bottom, 'the runner is still up in the air from the bounce').toBeLessThan(FLOOR_TOP - HALF_TILE);
  },
});
