import { expect } from '@playwright/test';
import { hold, scenario, wait } from './kit.ts';

/**
 * Opens the clam at (22, 6), which rolls Jet Fins on seed 1, climbs to row 4 and swims into the
 * urchin at (32, 4) at tick 588. Input stops two ticks later, so the knockback carries the player
 * away from the dropped pickup and nobody grabs it before the scenario ends.
 */
export default scenario({
  description: 'an urchin hit knocks the newest power-up off the player and leaves it as a loose pickup',
  start: { scene: 'race', seed: 1 },
  input: [wait(180), hold('right', 300), hold(['right', 'up'], 50), hold('right', 60), wait(40)],
  expect({ summary, events }) {
    const hits = events.filter((e) => e.type === 'racer.hit' && e.id === 'player');
    expect(hits[0]).toMatchObject({ cause: 'urchin', by: null });
    const lost = events.filter((e) => e.type === 'powerup.lost' && e.id === 'player');
    expect(lost).toMatchObject([{ kind: 'jetFin', cause: 'hit', tick: hits[0]?.tick }]);
    const spawned = events.filter((e) => e.type === 'loose.spawned').map(({ tick, kind }) => ({ tick, kind }));
    expect(spawned).toEqual(lost.map(({ tick, kind }) => ({ tick, kind })));
    expect(events.filter((e) => e.type === 'loose.grabbed' && e.id === 'player')).toEqual([]);
    expect(summary.stack).toEqual([]);
  },
});
