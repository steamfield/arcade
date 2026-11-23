/**
 * How hard a shark hunts on each level, through `stepWorld`: how far it sees and patrols, how long it
 * rests after a charge, and whether it steers at its target mid-charge. Easy never hunts the player,
 * so the comparisons with Easy use a rival moved into the player's water.
 */
import type { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../events.ts';
import { length } from '../../num.ts';
import { centreOf } from '../../racers.ts';
import { eventsIn, placeAt, racerOf, step, tileCentre } from '../../test-world.ts';
import { type Difficulty, type RacerId, TILE, type Vec, type World } from '../../types.ts';
import { ARENA_TOP, arena, enemyAt } from './test-arena.ts';
import { SHARK } from './tuning.ts';

/** Nine rows of open water with a shark at col 20 of the middle row, facing left; the player starts far off at col 1. */
const OPEN = [
  '##############################',
  '#...........................F#',
  '#...........................F#',
  '#...........................F#',
  '#...........................F#',
  '#...................S.......F#',
  '#...........................F#',
  '#...........................F#',
  '#...........................F#',
  '#1..........................F#',
  '##############################',
];

const SHARK_COL = 20;
const SHARK_ROW = ARENA_TOP + 5;

/** A race on OPEN at `difficulty`, with the shark and the rival Tess at hand. */
function open(difficulty: Difficulty) {
  const { world, log } = arena(OPEN, { difficulty });
  return { world, log, shark: enemyAt(world), tess: racerOf(world, 'tess') };
}

/** Steps `ticks` times, putting racer `id`'s centre back on `at` before each. */
function pinnedAt(world: World, log: EventLog<GameEvent>, id: RacerId, at: Vec, ticks: number): void {
  for (let tick = 0; tick < ticks; tick++) {
    placeAt(racerOf(world, id), at);
    step(world, log);
  }
}

/** Steps while the shark is in `mode`, at most `limit` ticks, with Tess pinned on `at`; returns the ticks stepped. */
function ticksWhile(world: World, log: EventLog<GameEvent>, mode: string, at: Vec, limit: number): number {
  const shark = enemyAt(world);
  let ticks = 0;
  for (; ticks < limit && shark.mode === mode; ticks++) pinnedAt(world, log, 'tess', at, 1);
  return ticks;
}

describe('a shark on each level', () => {
  it.each([
    ['hard', true],
    ['easy', false],
  ] as const)('on %s winds up on a racer 7.5 tiles ahead: %s', (difficulty, windsUp) => {
    const { world, log } = open(difficulty);
    const ahead = { x: (SHARK_COL + 0.5 - 7.5) * TILE, y: (SHARK_ROW + 0.5) * TILE };
    pinnedAt(world, log, 'tess', ahead, 5);

    expect(eventsIn(log, 'enemy.telegraphed')).toEqual(
      windsUp ? [{ type: 'enemy.telegraphed', index: 0, kind: 'shark' }] : [],
    );
  });

  it.each([
    ['hard', 4],
    ['easy', 3],
  ] as const)('on %s patrols out %i tiles from home before turning', (difficulty, patrolTiles) => {
    const { world, log, shark } = open(difficulty);
    const player = racerOf(world, 'player');
    const xs: number[] = [];
    for (let tick = 0; tick < 1200; tick++) {
      // Invulnerable, so the shark never picks it.
      player.status.invulnerable = 2;
      step(world, log);
      xs.push(shark.at.x);
    }
    const home = (SHARK_COL + 0.5) * TILE;
    const reach = patrolTiles * TILE;

    expect(Math.min(...xs)).toBeCloseTo(home - reach, 0);
    expect(Math.max(...xs)).toBeCloseTo(home + reach, 0);
  });

  it.each([
    ['hard', 24],
    ['easy', 40],
  ] as const)('on %s patrols again %i ticks after a charge ends', (difficulty, recoverTicks) => {
    const { world, log, shark, tess } = open(difficulty);
    const inLine = tileCentre(SHARK_COL - 5, SHARK_ROW);
    pinnedAt(world, log, 'tess', inLine, SHARK.windupTicks + 1);
    expect(shark.mode).toBe('charge');
    // Invulnerable, so the charge runs straight through it and nothing is spotted afterwards.
    tess.status.invulnerable = 1000;
    ticksWhile(world, log, 'charge', inLine, SHARK.chargeTicks + 1);

    expect(shark.mode).toBe('recover');
    expect(ticksWhile(world, log, 'recover', inLine, 100)).toBe(recoverTicks);
    expect(shark.mode).toBe('patrol');
  });

  it('on Hard ends a charge closer to a racer that moved off the line than Easy, which charges straight', () => {
    const ends = (['hard', 'easy'] as const).map((difficulty) => {
      const { world, log, shark, tess } = open(difficulty);
      pinnedAt(world, log, 'tess', tileCentre(SHARK_COL - 5, SHARK_ROW), SHARK.windupTicks + 1);
      const offLine = { x: (SHARK_COL - 4.5) * TILE, y: (SHARK_ROW + 0.5 - 1.5) * TILE };
      const headings: Vec[] = [];
      for (let tick = 0; tick < SHARK.chargeTicks + 1 && shark.mode === 'charge'; tick++) {
        headings.push({ x: shark.vel.x / SHARK.chargeSpeed, y: shark.vel.y / SHARK.chargeSpeed });
        pinnedAt(world, log, 'tess', offLine, 1);
      }
      const centre = centreOf(tess);
      return { headings, distance: length(shark.at.x - centre.x, shark.at.y - centre.y) };
    });
    const [hard, easy] = ends;

    expect(hard?.distance).toBeLessThan(easy?.distance ?? 0);
    expect(new Set(hard?.headings.map((heading) => heading.y)).size).toBeGreaterThan(1);
    expect(new Set(easy?.headings.map((heading) => `${heading.x},${heading.y}`)).size).toBe(1);
  });

  it('on Hard misses a racer that is four tiles off the line once the charge is under way', () => {
    const { world, log, shark } = open('hard');
    // Three tiles ahead, so a racer straight above the line is still within one charge's reach.
    pinnedAt(world, log, 'player', tileCentre(SHARK_COL - 3, SHARK_ROW), SHARK.windupTicks + 1);
    expect(shark.mode).toBe('charge');
    pinnedAt(world, log, 'player', tileCentre(SHARK_COL - 3, SHARK_ROW - 4), SHARK.chargeTicks + 1);

    expect(shark.mode).toBe('recover');
    expect(eventsIn(log, 'enemy.charged', 'racer.hit')).toEqual([
      { type: 'enemy.charged', index: 0, kind: 'shark', target: 'player' },
    ]);
  });
});
