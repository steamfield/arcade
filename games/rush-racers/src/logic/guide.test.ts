import { describe, expect, it } from 'vitest';
import { assistedIntent, guideFor } from './guide.ts';
import { hold, IDLE, placeOnTile, raceOn, racerOf, step } from './test-world.ts';
import type { Difficulty, TickInput } from './types.ts';

/** A wall across the player's lane with the only gap in the bottom row, so from the wall the way on is down. */
const PILLAR = `
  ####################
  #1....#...........F#
  #2....#...........F#
  #3....#...........F#
  #4................F#
  ####################
`;

const RIGHT: TickInput = hold({ x: 1, y: 0 });
const UP: TickInput = hold({ x: 0, y: -1 });

/** The pillar race on `difficulty`, the player resting against the wall's left face. */
function atTheWall(difficulty: Difficulty) {
  const { world, log } = raceOn(PILLAR);
  world.difficulty = difficulty;
  const player = racerOf(world, 'player');
  placeOnTile(player, 5, 1);
  return { world, log, player };
}

/** Holds `input` until the player's body passes the wall or `limit` ticks go by; returns the ticks used. */
function holdUntilPast(difficulty: Difficulty, input: TickInput, limit: number) {
  const { world, log, player } = atTheWall(difficulty);
  let ticks = 0;
  while (ticks < limit && player.body.x < 7 * 16) {
    step(world, log, 1, input);
    ticks++;
  }
  return { ticks, world, player };
}

describe('guideFor', () => {
  it('points from the wall toward the gap, and nowhere on the finish tile', () => {
    const { world, player } = atTheWall('easy');
    expect(guideFor(world, player).dir).toEqual({ x: 0, y: 1 });
    placeOnTile(player, 18, 2);
    expect(guideFor(world, player).dir).toBeNull();
  });

  it('counts the ticks the player pushes without getting closer, and starts over when they do', () => {
    const { world, log, player } = atTheWall('easy');
    step(world, log, 40, RIGHT);
    expect(guideFor(world, player).stuckTicks).toBeGreaterThanOrEqual(35);
    step(world, log, 30, hold({ x: 0, y: 1 }));
    expect(guideFor(world, player).stuckTicks).toBeLessThan(25);
  });

  it('holds the count while the stick is let go', () => {
    const { world, log, player } = atTheWall('easy');
    step(world, log, 40, RIGHT);
    const stuck = guideFor(world, player).stuckTicks;
    step(world, log, 20, IDLE);
    expect(guideFor(world, player).stuckTicks).toBe(stuck);
  });

  it('is zero for a rival', () => {
    const { world } = atTheWall('easy');
    world.guide.stuckTicks = 200;
    expect(guideFor(world, racerOf(world, 'tess')).stuckTicks).toBe(0);
  });
});

describe('the steering assist', () => {
  it('gets a player holding right at the wall around it, where holding alone stays stuck', () => {
    const helped = holdUntilPast('easy', RIGHT, 600);
    const alone = holdUntilPast('hard', RIGHT, 600);
    expect(helped.player.body.x, `easy took ${helped.ticks} ticks`).toBeGreaterThanOrEqual(7 * 16);
    expect(helped.ticks).toBeLessThan(300);
    expect(alone.player.body.x).toBeLessThan(6 * 16);
  });

  it('leaves the input alone on Normal and Hard, and tracks nothing', () => {
    for (const difficulty of ['normal', 'hard'] as const) {
      const { world, log, player } = atTheWall(difficulty);
      step(world, log, 100, RIGHT);
      expect(world.guide, difficulty).toEqual({ bestSteer: Number.POSITIVE_INFINITY, stuckTicks: 0, helpTicks: 0 });
      expect(assistedIntent(world, player, RIGHT), difficulty).toBe(RIGHT);
    }
  });

  it('waits out the grace before it helps', () => {
    const { world, log, player } = atTheWall('easy');
    step(world, log, 20, RIGHT);
    expect(assistedIntent(world, player, RIGHT)).toBe(RIGHT);
    step(world, log, 40, RIGHT);
    expect(assistedIntent(world, player, RIGHT).move.y).toBeGreaterThan(0);
  });

  it('never pushes against a stick held the other way', () => {
    const { world, log, player } = atTheWall('easy');
    step(world, log, 80, RIGHT);
    // The way on is down: a stick held up, or up and right, is the other way and gets no help.
    expect(assistedIntent(world, player, UP)).toBe(UP);
    const upRight = hold({ x: 1, y: -1 });
    expect(assistedIntent(world, player, upRight)).toBe(upRight);
  });

  it('never helps a rival, and keeps the stick within a full stick', () => {
    const { world, log, player } = atTheWall('easy');
    step(world, log, 80, RIGHT);
    expect(assistedIntent(world, racerOf(world, 'tess'), RIGHT)).toBe(RIGHT);
    const { move } = assistedIntent(world, player, RIGHT);
    expect(Math.abs(move.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(move.y)).toBeLessThanOrEqual(1);
  });
});
