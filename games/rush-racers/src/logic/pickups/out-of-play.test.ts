/**
 * A racer that is out of play (`status.fallen > 0`, waiting to be put back after a pit or a black
 * hole) collects nothing, however long it waits on top of a pickup.
 */
import { describe, expect, it } from 'vitest';
import { eventsIn, placeOnTile, raceOn, racerOf, step, tileCentre } from '../test-world.ts';
import { spawnLoose } from './loose.ts';

const POOL = `
  ##########
  #1....o.F#
  #2....?.F#
  #3......F#
  #4......F#
  ##########
`;

/** A race on the pool with the player out of play on tile (`tx`, `ty`) and every rival held where it starts. */
function outOn(tx: number, ty: number) {
  const { world, log } = raceOn(POOL);
  const player = racerOf(world, 'player');
  for (const racer of world.racers) if (racer !== player) racer.status.trapped = 100_000;
  placeOnTile(player, tx, ty);
  player.status.fallen = 1000;
  return { world, log, player };
}

describe('a racer that is out of play', () => {
  it('collects no pearl it waits on, and collects it once it is back', () => {
    const { world, log, player } = outOn(6, 1);
    step(world, log, 30);

    expect(eventsIn(log, 'pearl.collected')).toEqual([]);

    player.status.fallen = 0;
    step(world, log, 1);
    expect(eventsIn(log, 'pearl.collected')).toHaveLength(1);
  });

  it('opens no clam it waits on', () => {
    const { world, log, player } = outOn(6, 2);
    step(world, log, 30);

    expect(eventsIn(log, 'clam.opened')).toEqual([]);
    expect(player.items.every((item) => item === null)).toBe(true);
  });

  it('grabs no loose item or loose pearl lying on it', () => {
    const { world, log } = outOn(4, 3);
    spawnLoose(world, 'puffer', 1, tileCentre(4, 3));
    world.loosePearls.push({ at: tileCentre(4, 3), vel: { x: 0, y: 0 }, age: 100, droppedBy: null });
    step(world, log, 90);

    expect(eventsIn(log, 'loose.grabbed', 'loosePearl.collected')).toEqual([]);
  });
});
