import { expect } from '@playwright/test';
import { HARD_SAVE, hold, scenario, TITLE_TO_RACE, wait } from './kit.ts';

/** The dash timing below is Easy's swim speed, and on Easy the shark never winds up on the player, so pin it. */
const EASY_SAVE = {
  ...HARD_SAVE,
  data: { ...HARD_SAVE.data, settings: { ...HARD_SAVE.data.settings, difficulty: 'easy' } },
};

/**
 * The `enemies` stage stands the player on the floor with a crab on it 3 tiles ahead. After the
 * countdown, swim right for half a second and dash: the dash lands on the crab inside its bonk
 * window (about 7 to 11 ticks after the dash at Easy's swim speed), so the one bonk beats it and
 * it bursts into a pearl. On Easy the shark further on never winds up on the player.
 */
export default scenario({
  description: 'a dash into the crab bonks it once, beats it and bursts a pearl out of it',
  start: { save: EASY_SAVE, seed: 1, query: { stage: 'enemies' } },
  input: [...TITLE_TO_RACE, wait(180), hold('right', 30), hold(['right', 'dash'], 1), hold('right', 30)],
  expect({ events }) {
    expect(events.filter((e) => e.type === 'racer.kicked' && e.id === 'player')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'enemy.defeated')).toMatchObject([{ kind: 'crab', by: 'player' }]);
    expect(events.filter((e) => e.type === 'pearls.burst')).toMatchObject([{ count: 1 }]);
    expect(events.filter((e) => e.type === 'racer.hit' && e.id === 'player')).toEqual([]);
  },
});
