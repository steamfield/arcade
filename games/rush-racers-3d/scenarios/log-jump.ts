import { expect } from '@playwright/test';
import { hold, ofPlayer, scenario } from './kit.ts';

export default scenario({
  description: 'holding jump as the first log comes up clears it with no bump',
  start: { query: { stage: 'before-log' } },
  // From 20 m out at run speed the log arrives after about 1.6 s; jump a little before it.
  input: [hold('forward', 75), hold(['forward', 'jump'], 25), hold('forward', 60)],
  expect({ summary, events }) {
    const mine = ofPlayer(events);
    expect(mine.map((e) => e.type)).toContain('racer.jumped');
    expect(mine.filter((e) => e.type === 'racer.bumped' && e.by === null)).toEqual([]);
    expect((summary as { player: { s: number } }).player.s).toBeGreaterThan(62);
  },
});
