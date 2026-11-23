/**
 * Eels through `stepWorld`: hidden in a wall hole, a telegraphed lunge out and back on a fixed cycle,
 * and only while out can one hurt a racer or be bonked.
 */
import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../events.ts';
import { LevelError } from '../../level/parse.ts';
import { courseFromLevel, eventsIn, hold, placeOnTile, racerOf, step, ticksOf } from '../../test-world.ts';
import { TILE } from '../../types.ts';
import { createWorld } from '../../world.ts';
import { ARENA_TOP, arena, enemyAt, towardEnemy } from './test-arena.ts';
import { EEL } from './tuning.ts';

/** An eel in the ceiling at col 5, lunging straight down. */
const CEILING = ['############', '#....E....F#', '#1........F#', '#.........F#', '#.........F#', '############'];

const HOME_ROW = ARENA_TOP + 1;
const HIDDEN_TICKS = EEL.cycleTicks - EEL.telegraphTicks - EEL.lungeTicks;

/** Steps `ticks` times with the player put back on tile (`col`, `row`) before each. */
function pinned(
  world: ReturnType<typeof arena>['world'],
  log: ReturnType<typeof arena>['log'],
  at: [number, number],
  ticks: number,
) {
  for (let tick = 0; tick < ticks; tick++) {
    placeOnTile(racerOf(world, 'player'), at[0], at[1]);
    step(world, log);
  }
}

describe('an eel', () => {
  it('shows its warning every cycle, then lunges two tiles out of the wall and back', () => {
    const { world, log } = arena(CEILING);
    const eel = enemyAt(world);
    const drops: number[] = [];
    for (let tick = 0; tick < 2 * EEL.cycleTicks; tick++) {
      placeOnTile(racerOf(world, 'player'), 9, ARENA_TOP + 4);
      step(world, log);
      drops.push(eel.at.y - (HOME_ROW + 0.5) * TILE);
      expect(eel.at.x).toBe(5.5 * TILE);
    }

    expect(ticksOf(log, 'enemy.telegraphed')).toEqual([HIDDEN_TICKS, HIDDEN_TICKS + EEL.cycleTicks]);
    expect(eventsIn(log, 'enemy.telegraphed')[0]).toEqual({ type: 'enemy.telegraphed', index: 0, kind: 'eel' });
    expect(Math.max(...drops)).toBe(EEL.lungeTiles * TILE);
    expect(Math.min(...drops)).toBe(0);
    expect(drops.at(-1)).toBe(0);
  });

  it('touches nobody while hidden or warning, then hits a racer in its way once out', () => {
    const { world, log } = arena(CEILING);
    pinned(world, log, [5, HOME_ROW], HIDDEN_TICKS + EEL.telegraphTicks - 1);

    expect(eventsIn(log, 'racer.hit')).toEqual([]);
    pinned(world, log, [5, HOME_ROW + 1], EEL.lungeTicks);
    expect(eventsIn(log, 'racer.hit')).toEqual([{ type: 'racer.hit', id: 'player', cause: 'eel', by: null }]);
  });

  it('is not bonked by a dash through its hole while hidden', () => {
    const { world, log } = arena(CEILING);
    placeOnTile(racerOf(world, 'player'), 3, HOME_ROW);
    step(world, log, 1, hold({ x: 1, y: 0 }, { kick: true }));
    step(world, log, 30, hold({ x: 1, y: 0 }));

    expect(eventsIn(log, 'enemy.bonked')).toEqual([]);
    expect(enemyAt(world).mode).toBe('hidden');
  });

  it('is beaten by one bonk while out, bursting two pearls', () => {
    const { world, log } = arena(CEILING);
    const eel = enemyAt(world);
    pinned(world, log, [5, HOME_ROW + 3], HIDDEN_TICKS + EEL.telegraphTicks + 4);
    step(world, log, 1, hold(towardEnemy(world, eel), { kick: true }));
    step(world, log, 8, hold(towardEnemy(world, eel)));

    expect(eventsIn(log, 'racer.hit', 'enemy.bonked', 'enemy.defeated', 'pearls.burst')).toEqual([
      { type: 'enemy.bonked', index: 0, kind: 'eel', by: 'player', hpLeft: 0 },
      { type: 'enemy.defeated', index: 0, kind: 'eel', by: 'player' },
      { type: 'pearls.burst', index: 0, count: EEL.pearls },
    ]);
    step(world, log, 2 * EEL.cycleTicks);
    expect(ticksOf(log, 'enemy.telegraphed')).toHaveLength(1);
  });

  it.each([
    ['with no rock beside it', '#1....F#\n#2..E.F#\n#3....F#\n#4....F#', 2, 4],
    ['with rock in the way of its lunge', '#1....F#\n#2....F#\n##E.#.F#\n#3....F#\n#4....F#', 3, 2],
  ])('refuses an eel %s, naming its tile', (_name, rows, row, col) => {
    const course = courseFromLevel(`########\n${rows}\n########`);
    const create = () => createWorld(course, new EventLog<GameEvent>(), { seed: 1 });

    expect(create).toThrow(LevelError);
    expect(create).toThrow(expect.objectContaining({ row, col }));
  });
});
