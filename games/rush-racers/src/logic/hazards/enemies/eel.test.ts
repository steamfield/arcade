/**
 * Eels through `stepWorld`: hidden in a wall hole, a telegraphed lunge out and back on a fixed cycle,
 * and only while out can one hurt a racer or be bonked.
 */
import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../events.ts';
import { LevelError } from '../../level/parse.ts';
import { courseFromLevel, eventsIn, hold, placeOnTile, racerOf, step, ticksOf } from '../../test-world.ts';
import { type Enemy, TILE, type World } from '../../types.ts';
import { createWorld } from '../../world.ts';
import { ARENA_TOP, arena, enemyAt, towardEnemy } from './test-arena.ts';
import { EEL } from './tuning.ts';

/** An eel in the ceiling at col 5, lunging straight down. */
const CEILING = ['############', '#....E....F#', '#1........F#', '#.........F#', '#.........F#', '############'];

const HOME_ROW = ARENA_TOP + 1;
const HIDDEN_TICKS = EEL.cycleTicks - EEL.telegraphTicks - EEL.lungeTicks;
/** Where an eel at `col`, `row` starts in its cycle: a level-made offset so neighbouring eels lunge out of step. */
const startOffset = (col: number, row: number) => (col * 37 + row * 11) % EEL.cycleTicks;

/**
 * Starts the world's eel over at the beginning of its hidden phase, so a test can count its cycle from
 * tick 0. The CEILING eel would otherwise start partway through its warning.
 */
function fromHidden(world: World): Enemy {
  const eel = enemyAt(world);
  eel.mode = 'hidden';
  eel.modeTicks = 0;
  return eel;
}

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
    const eel = fromHidden(world);
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
    fromHidden(world);
    pinned(world, log, [5, HOME_ROW], HIDDEN_TICKS + EEL.telegraphTicks - 1);

    expect(eventsIn(log, 'racer.hit')).toEqual([]);
    pinned(world, log, [5, HOME_ROW + 1], EEL.lungeTicks);
    expect(eventsIn(log, 'racer.hit')).toEqual([{ type: 'racer.hit', id: 'player', cause: 'eel', by: null }]);
  });

  it('is not bonked by a dash through its hole while hidden', () => {
    const { world, log } = arena(CEILING);
    fromHidden(world);
    placeOnTile(racerOf(world, 'player'), 3, HOME_ROW);
    step(world, log, 1, hold({ x: 1, y: 0 }, { kick: true }));
    step(world, log, 30, hold({ x: 1, y: 0 }));

    expect(eventsIn(log, 'enemy.bonked')).toEqual([]);
    expect(enemyAt(world).mode).toBe('hidden');
  });

  it('is beaten by one bonk while out, bursting two pearls', () => {
    const { world, log } = arena(CEILING);
    const eel = fromHidden(world);
    pinned(world, log, [5, HOME_ROW + 3], HIDDEN_TICKS + EEL.telegraphTicks + 4);
    step(world, log, 1, hold(towardEnemy(world, eel), { kick: true }));
    step(world, log, 8, hold(towardEnemy(world, eel)));

    expect(eventsIn(log, 'racer.hit', 'enemy.bonked', 'enemy.defeated', 'pearls.burst')).toEqual([
      { type: 'enemy.bonked', index: 0, kind: 'eel', by: 'player', hpLeft: 0, how: 'dash' },
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

describe('eels at the start of a race', () => {
  it('start at different points of their cycle at different homes, the same way every time', () => {
    const twoEels = ['############', '#.E...E...F#', '#1........F#', '#.........F#', '#.........F#', '############'];
    const { world, log } = arena(twoEels);
    step(world, log, HIDDEN_TICKS);

    expect(eventsIn(log, 'enemy.telegraphed')).toEqual([
      { type: 'enemy.telegraphed', index: 0, kind: 'eel' },
      { type: 'enemy.telegraphed', index: 1, kind: 'eel' },
    ]);
    expect(ticksOf(log, 'enemy.telegraphed')).toEqual([
      HIDDEN_TICKS - startOffset(2, HOME_ROW),
      HIDDEN_TICKS - startOffset(6, HOME_ROW),
    ]);
    expect(arena(twoEels).world.enemies).toEqual(arena(twoEels).world.enemies);
  });

  it('starts out of its hole when its start lands in its lunge', () => {
    const wallEel = ['############', '#1........F#', '#E........F#', '#.........F#', '############'];
    const home = { x: 1, y: ARENA_TOP + 2 };
    const eel = enemyAt(arena(wallEel).world);

    expect(startOffset(home.x, home.y)).toBeGreaterThan(HIDDEN_TICKS + EEL.telegraphTicks);
    expect(eel.mode).toBe('lunge');
    expect(eel.at.x).toBeGreaterThan((home.x + 0.5) * TILE);
    expect(eel.at.y).toBe((home.y + 0.5) * TILE);
  });

  it('warns on its next warning, not at creation, when its start lands in its warning', () => {
    const { world, log } = arena(CEILING);
    const offset = startOffset(5, HOME_ROW);

    expect(offset).toBeGreaterThanOrEqual(HIDDEN_TICKS);
    expect(enemyAt(world)).toMatchObject({ mode: 'windup', at: { x: 5.5 * TILE, y: (HOME_ROW + 0.5) * TILE } });
    expect(eventsIn(log)).toEqual([]);
    pinned(world, log, [9, ARENA_TOP + 4], EEL.cycleTicks);
    expect(ticksOf(log, 'enemy.telegraphed')).toEqual([EEL.cycleTicks - offset + HIDDEN_TICKS]);
  });
});
