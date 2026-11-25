import { expect } from '@playwright/test';
import { hold, ofPlayer, scenario, tap, wait } from './kit.ts';

export default scenario({
  description: 'running through the first crate fills a slot, and fire uses that item and spends a charge',
  start: { scene: 'race', seed: 1 },
  // The first crate sits on the player's grid lane just before the first log; jump the log, then fire.
  input: [
    wait(180),
    hold('forward', 230),
    hold(['forward', 'jump'], 20),
    hold('forward', 30),
    tap('fire'),
    hold('forward', 30),
  ],
  expect({ events }) {
    const mine = ofPlayer(events);
    const opened = mine.find((e) => e.type === 'crate.opened');
    expect(opened).toBeDefined();
    expect(mine).toContainEqual(expect.objectContaining({ type: 'item.fired', kind: opened?.kind }));
    expect(mine.findIndex((e) => e.type === 'crate.opened')).toBeLessThan(
      mine.findIndex((e) => e.type === 'item.fired'),
    );
  },
});
