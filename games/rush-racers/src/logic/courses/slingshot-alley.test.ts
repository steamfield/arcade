/** What Slingshot Alley has to contain to be Farside's course: its size, its set pieces (wells, asteroids) and where nothing may lie. */
import { describe, expect, it } from 'vitest';
import { holeAt } from '../level/wells.ts';
import { type Cell, TILE, type Vec } from '../types.ts';
import { COURSES, levelOf } from './index.ts';

const course = COURSES['slingshot-alley'];
const level = levelOf(course);
const bramble = COURSES['bramble-run'];

const count = (cells: readonly Cell[]): number => level.cells.flat().filter((cell) => cells.includes(cell)).length;
const centreOfTile = (tile: Vec): Vec => ({ x: (tile.x + 0.5) * TILE, y: (tile.y + 0.5) * TILE });

describe('Slingshot Alley', () => {
  it('is a Farside course of its own, not Drift Test under another name', () => {
    expect(course.world).toBe('farside');
    expect(level.cells).not.toEqual(levelOf(COURSES['drift-test']).cells);
  });

  it('is about as long as Bramble Run, in tiles and in par', () => {
    const width = level.width / levelOf(bramble).width;
    const par = course.parTicks / bramble.parTicks;

    expect(width).toBeGreaterThanOrEqual(0.8);
    expect(width).toBeLessThanOrEqual(1.3);
    expect(par).toBeGreaterThanOrEqual(0.8);
    expect(par).toBeLessThanOrEqual(1.25);
  });

  it("has a stretch in a moon's shadow at least 40 columns long", () => {
    expect(Math.max(0, ...level.dark.map(([from, to]) => to - from + 1))).toBeGreaterThanOrEqual(40);
  });

  it('has at least three planets and exactly two black holes', () => {
    expect(level.wells.filter((well) => well.horizon === null).length).toBeGreaterThanOrEqual(3);
    expect(level.wells.filter((well) => well.horizon !== null)).toHaveLength(2);
  });

  it('has ice, nebula dust and solar wind', () => {
    expect(count(['coral'])).toBeGreaterThan(0);
    expect(count(['kelp'])).toBeGreaterThan(0);
    expect(count(['current-right', 'current-left', 'current-up', 'current-down'])).toBeGreaterThan(0);
  });

  it('has every enemy kind, a space mine and a plasma orb', () => {
    expect(new Set(level.enemies.map((enemy) => enemy.kind))).toEqual(new Set(['shark', 'eel', 'crab']));
    expect(level.urchins.length).toBeGreaterThan(0);
    expect(level.jellies.length).toBeGreaterThan(0);
  });

  it('has 4-6 drifting asteroids out of step, on the opening straight and across the dust field', () => {
    const { asteroids } = level;
    const inCols = (from: number, to: number) =>
      asteroids.filter((asteroid) => asteroid.from[0] >= from && asteroid.to[0] <= to).length;

    expect(asteroids.length).toBeGreaterThanOrEqual(4);
    expect(asteroids.length).toBeLessThanOrEqual(6);
    expect(inCols(1, 98)).toBeGreaterThan(0);
    expect(inCols(224, 270)).toBeGreaterThan(0);
    expect(new Set(asteroids.map((asteroid) => `${asteroid.periodTicks}/${asteroid.offsetTicks}`)).size).toBe(
      asteroids.length,
    );
  });

  it('has at least 40 stardust and 10 supply pods, none inside a horizon', () => {
    expect(level.pearls.length).toBeGreaterThanOrEqual(40);
    expect(level.clams.length).toBeGreaterThanOrEqual(10);
    expect([...level.pearls, ...level.clams].filter((tile) => holeAt(level, centreOfTile(tile)))).toEqual([]);
  });
});
