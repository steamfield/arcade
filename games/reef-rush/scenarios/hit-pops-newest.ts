import { expect } from '@playwright/test';
import { hold, scenario, wait } from './kit.ts';

/**
 * Opens the clam at (22, 6), climbs to row 4 and swims into the urchin at (32, 4). A Bubble Shield
 * absorbs the hit instead (`shield.popped`), so which events appear depends on the clam's roll;
 * either way the stack ends empty and a knocked-off power-up shows up as a loose pickup.
 */
export default scenario({
  description: 'an urchin hit knocks the newest power-up off the player and leaves it as a loose pickup',
  start: { scene: 'race' },
  input: [wait(180), hold('right', 300), hold(['right', 'up'], 50), hold('right', 100), wait(10)],
  expect({ summary, events }) {
    const hits = events.filter((e) => e.type === 'racer.hit' && e.id === 'player');
    expect(hits).toMatchObject([{ cause: 'urchin', by: null }]);
    const lost = events.filter((e) => e.type === 'powerup.lost' && e.id === 'player');
    const absorbed = events.filter((e) => e.type === 'shield.popped' && e.id === 'player');
    expect(lost.length + absorbed.length).toBe(1);
    expect(events.filter((e) => e.type === 'loose.spawned').map((e) => e.kind)).toEqual(lost.map((e) => e.kind));
    expect(lost.every((e) => e.cause === 'hit')).toBe(true);
    expect(summary.stack).toEqual([]);
  },
});
