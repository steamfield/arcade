import { expect } from '@playwright/test';
import { hold, scenario, wait } from './kit.ts';

/** The first clam sits on the start row at tile (22, 6), so the player just swims right into it. */
export default scenario({
  description: 'swimming into a clam opens it and puts its power-up in the first slot, selected, as the summary shows',
  start: { scene: 'race', seed: 1 },
  input: [wait(180), hold('right', 330), wait(30)],
  expect({ summary, events }) {
    const firstClam = events.filter((e) => e.type === 'clam.opened' && e.index === 0);
    // A rival opening it first would leave the player empty-handed; name that here rather than failing on the items.
    expect(firstClam.filter((e) => e.id !== 'player')).toEqual([]);
    expect(firstClam.filter((e) => e.id === 'player')).toHaveLength(1);
    const gained = events.filter((e) => e.type === 'powerup.gained' && e.id === 'player');
    expect(gained).toMatchObject([{ kind: firstClam[0]?.kind, slot: 0 }]);
    const [first] = gained;
    const charges = first?.type === 'powerup.gained' ? first.charges : 0;
    expect(summary).toMatchObject({ items: [`${firstClam[0]?.kind}:${charges}`, null, null], selected: 0 });
  },
});
