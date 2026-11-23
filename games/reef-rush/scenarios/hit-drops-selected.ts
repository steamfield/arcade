import { expect } from '@playwright/test';
import { hold, scenario, wait } from './kit.ts';

/**
 * The `icons-a` stage fills the player's three slots (Homing Squid selected, Riptide, Undertow), so
 * the first clam stays shut for them. The player climbs to row 4 and swims into the urchin at
 * (32, 4). A fresh save races on Easy, whose catch-up push sets the run-up. The hit knocks the
 * selected Homing Squid loose with its one charge, the selection moves on to the Riptide, and the
 * knockback carries the player away from the pickup before anyone grabs it.
 */
export default scenario({
  description: 'an urchin hit knocks the selected item loose with its charges and selects the next one',
  start: { scene: 'race', seed: 1, query: { stage: 'icons-a' } },
  input: [wait(180), hold('right', 250), hold(['right', 'up'], 50), hold('right', 80), wait(40)],
  expect({ summary, events }) {
    const hits = events.filter((e) => e.type === 'racer.hit' && e.id === 'player');
    expect(hits[0]).toMatchObject({ cause: 'urchin', by: null });
    const lost = events.filter((e) => e.type === 'powerup.lost' && e.id === 'player');
    expect(lost).toMatchObject([{ kind: 'homingSquid', cause: 'hit', tick: hits[0]?.tick }]);
    const spawned = events.filter((e) => e.type === 'loose.spawned');
    expect(spawned).toMatchObject([{ kind: 'homingSquid', charges: 1, tick: hits[0]?.tick }]);
    expect(events.filter((e) => e.type === 'loose.grabbed' && e.id === 'player')).toEqual([]);
    expect(summary).toMatchObject({ items: [null, 'riptide:2', 'undertow:1'], selected: 1 });
  },
});
