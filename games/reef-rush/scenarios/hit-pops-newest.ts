import { expect } from '@playwright/test';
import { hold, scenario, wait } from './kit.ts';

/**
 * Opens the clam at (22, 6), climbs to row 4 and swims into the urchin at (32, 4), reached about
 * tick 610 overall (input ends at 620, so the player can't drift into anything else). A Bubble
 * Shield absorbs the hit instead (`shield.popped`), so which events appear depends on the clam's
 * roll; either way the stack ends empty and a knocked-off power-up is a loose pickup nobody grabs.
 */
export default scenario({
  description: 'an urchin hit knocks the newest power-up off the player and leaves it as a loose pickup',
  start: { scene: 'race', seed: 1 },
  input: [wait(180), hold('right', 300), hold(['right', 'up'], 50), hold('right', 90), wait(20)],
  expect({ summary, events }) {
    const hits = events.filter((e) => e.type === 'racer.hit' && e.id === 'player');
    expect(hits[0]).toMatchObject({ cause: 'urchin', by: null });
    const lost = events.filter((e) => e.type === 'powerup.lost' && e.id === 'player');
    const absorbed = events.filter((e) => e.type === 'shield.popped' && e.id === 'player');
    expect(lost.length + absorbed.length).toBe(1);
    expect(lost.every((e) => e.cause === 'hit')).toBe(true);
    const spawned = events.filter((e) => e.type === 'loose.spawned').map(({ tick, kind }) => ({ tick, kind }));
    expect(spawned).toEqual(lost.map(({ tick, kind }) => ({ tick, kind })));
    expect(events.filter((e) => e.type === 'loose.grabbed' && e.id === 'player')).toEqual([]);
    expect(summary.stack).toEqual([]);
  },
});
