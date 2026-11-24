import { expect } from '@playwright/test';
import { HARD_SAVE, hold, scenario, tap, wait } from './kit.ts';

/** The acorns on the far shelf and the low floor, in Run Test's reading order. */
const HIGH_ACORN = 7;
const LOW_ACORN = 8;

export default scenario({
  description: 'the player crosses a shaking branch and the following rival finishes by the low road',
  start: { save: HARD_SAVE, seed: 1, query: { course: 'run-test' } },
  input: [
    wait(25),
    tap('fire'),
    wait(25),
    tap('fire'),
    wait(180),
    // Hop past the pack, then clear the cracked stone and beetle together.
    hold(['right', 'up'], 4),
    hold(['right', 'up', 'dash'], 1),
    hold(['right', 'up'], 15),
    hold('right', 70),
    hold(['right', 'up', 'dash'], 1),
    hold(['right', 'up'], 19),
    // Land on the crate and jump from it across the pit.
    hold('right', 33),
    hold(['right', 'up'], 26),
    hold('right', 4),
    hold(['right', 'up', 'dash'], 1),
    hold(['right', 'up'], 19),
    // Jump onto the branch at col 38 and climb from it onto the plateau.
    hold('right', 81),
    hold(['right', 'up', 'dash'], 1),
    hold(['right', 'up'], 19),
    hold('right', 20),
    hold(['right', 'up'], 20),
    // Leap over the mushroom, run across the rotten branch and stop on the far shelf.
    hold('right', 27),
    hold(['right', 'dash'], 1),
    hold('right', 17),
    hold(['right', 'up'], 8),
    hold('right', 110),
    wait(145),
  ],
  expect({ events, summary }) {
    const branchEvents = events.filter((event) => event.type.startsWith('crumble.'));
    expect(branchEvents.map(({ type }) => type)).toEqual(['crumble.shook', 'crumble.fell']);
    const [shook, fell] = branchEvents;
    expect((fell?.tick ?? 0) - (shook?.tick ?? 0)).toBe(40);
    const crossed = events.find((event) => event.type === 'pearl.collected' && event.index === HIGH_ACORN);
    expect(crossed).toMatchObject({ id: 'player' });
    expect(crossed?.tick).toBeGreaterThan(shook?.tick ?? 0);
    expect(crossed?.tick).toBeLessThan(fell?.tick ?? 0);
    const acorn = events.find((event) => event.type === 'pearl.collected' && event.index === LOW_ACORN);
    expect(acorn).toMatchObject({ id: 'bo' });
    expect(acorn?.tick).toBeGreaterThan(fell?.tick ?? 0);
    const finished = events.find((event) => event.type === 'racer.finished' && event.id === 'bo');
    expect(finished?.tick).toBeGreaterThan(acorn?.tick ?? 0);
    expect(events.filter((event) => event.type === 'racer.fell' && event.id === 'player')).toEqual([]);

    expect(summary).toMatchObject({ player: { tile: [64, 8] } });
  },
});
