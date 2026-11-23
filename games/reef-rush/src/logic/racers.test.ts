import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from './events.ts';
import { parseLevel } from './level/parse.ts';
import { activeRacers, playerOf } from './racers.ts';
import { createWorld } from './world.ts';

function setup() {
  const level = parseLevel({
    name: 'straight',
    ascii: `
      ########
      #1....F#
      #2....F#
      #3....F#
      #4....F#
      ########
    `,
  });
  return createWorld(level, new EventLog<GameEvent>(), { seed: 1 });
}

describe('racer queries', () => {
  it('lists unfinished racers in racer order, wherever they sit in the array', () => {
    const world = setup();
    world.racers.reverse();
    const squib = world.racers.find((r) => r.id === 'squib');
    if (squib) squib.finished = { tick: 40, place: 1, overshoot: 2 };

    expect(activeRacers(world).map((r) => r.id)).toEqual(['player', 'tess', 'bo']);
  });

  it('finds the player wherever it sits, and names the racers when it is missing', () => {
    const world = setup();
    world.racers.reverse();

    expect(playerOf(world).id).toBe('player');
    world.racers = world.racers.filter((r) => r.id !== 'player');
    expect(() => playerOf(world)).toThrow('World has no player racer (racers: bo, squib, tess)');
  });
});
