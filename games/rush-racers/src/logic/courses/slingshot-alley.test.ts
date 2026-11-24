/** What Slingshot Alley has to contain to be Farside's course: its size, its set pieces (wells, asteroids) and where nothing may lie. */
import { describe, expect, it } from 'vitest';
import { holeAt, inHoleReach, pullAt } from '../level/wells.ts';
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

  it('has the same par target as Bramble Run with more columns for drift speed', () => {
    // Compare the lengthened courses once Bramble reaches 1000 columns, since drift needs more track for a similar par.
    const brambleWidth = levelOf(bramble).width;
    const bramblePar = bramble.parTicks;
    expect(level.width).toBeGreaterThan(brambleWidth);
    expect(level.width).toBeGreaterThanOrEqual(1300);
    expect(level.width).toBeLessThanOrEqual(1450);
    expect(course.parTicks).toBeGreaterThanOrEqual(9000);
    expect(course.parTicks).toBeLessThanOrEqual(10200);
    if (brambleWidth >= 1000) {
      expect(level.width / brambleWidth).toBeGreaterThanOrEqual(1.15);
      expect(level.width / brambleWidth).toBeLessThanOrEqual(1.5);
      expect(Math.abs(course.parTicks - bramblePar)).toBeLessThanOrEqual(1200);
    }
  });

  it("has a stretch in a moon's shadow at least 40 columns long", () => {
    expect(Math.max(0, ...level.dark.map(([from, to]) => to - from + 1))).toBeGreaterThanOrEqual(40);
  });

  it('keeps both black holes in the late split and adds one by the wormway shortcut', () => {
    expect(level.wells.filter((well) => well.horizon === null).length).toBeGreaterThanOrEqual(3);
    const holes = level.wells.filter((well) => well.horizon !== null);
    expect(holes).toHaveLength(3);
    const split = course.sections?.find((section) => section.name === 'BLACK HOLE SPLIT')?.fromCol ?? level.finishX;
    expect(holes.filter(({ centre }) => centre.x / TILE >= split)).toHaveLength(2);
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

  it('leaves the Debris Storm dust channel clear for racers to pass the shield', () => {
    const orbs = level.jellies.filter(({ x }) => x >= 603 && x <= 846);

    expect(orbs.length).toBeGreaterThan(0);
    expect(orbs.filter(({ x, y }) => x >= 737 && x <= 743 && y >= 21 && y <= 25)).toEqual([]);
  });

  it('has drifting asteroids out of step in the opening, dust field and debris corridor', () => {
    const { asteroids } = level;
    const inCols = (from: number, to: number) =>
      asteroids.filter((asteroid) => [asteroid.from[0], asteroid.to[0]].every((col) => col >= from && col <= to))
        .length;

    expect(asteroids).toHaveLength(11);
    expect(inCols(1, 98)).toBe(2);
    expect(inCols(224, 270)).toBe(3);
    expect(inCols(603, 846)).toBe(6);
    expect(new Set(asteroids.map((asteroid) => `${asteroid.periodTicks}/${asteroid.offsetTicks}`)).size).toBe(
      asteroids.length,
    );
  });

  it('teaches through a sealed two-way passage before sending racers to two different gravity exits', () => {
    const [wall, shortcut, neutral, loop, slingshot, split] = level.wormholes;
    expect(level.wormholes).toHaveLength(6);
    if (!wall || !shortcut || !neutral || !loop || !slingshot || !split) throw new Error('Missing wormway pair');

    const middle = Math.floor((wall.a[0] + wall.b[0]) / 2);
    expect(level.cells.every((row) => row[middle] === 'rock')).toBe(true);
    expect(wall.oneWay).toBe(false);

    const shortcutExit = centreOfTile({ x: shortcut.b[0], y: shortcut.b[1] });
    const cornerNearestHole = { x: shortcutExit.x + TILE / 2, y: shortcutExit.y + TILE / 2 };
    const insideReach = centreOfTile({ x: shortcut.b[0] + 1, y: shortcut.b[1] + 1 });
    expect(inHoleReach(level, shortcutExit)).toBe(false);
    expect(inHoleReach(level, cornerNearestHole)).toBe(false);
    expect(inHoleReach(level, insideReach)).toBe(true);
    expect(holeAt(level, insideReach)).toBeNull();
    expect(neutral.a[0]).toBe(neutral.b[0]);
    expect(neutral.oneWay).toBe(true);
    expect(loop.oneWay).toBe(true);
    expect(loop.b[0]).toBeLessThan(loop.a[0]);

    const slingshotExit = centreOfTile({ x: slingshot.b[0], y: slingshot.b[1] });
    expect(inHoleReach(level, slingshotExit)).toBe(false);
    expect(pullAt(level, slingshotExit).x).toBeGreaterThan(0);
    expect(split.b[0]).toBeGreaterThan(slingshot.b[0]);
  });

  it('has at least 40 stardust and 10 supply pods, none inside a horizon', () => {
    expect(level.pearls.length).toBeGreaterThanOrEqual(40);
    expect(level.clams.length).toBeGreaterThanOrEqual(10);
    expect([...level.pearls, ...level.clams].filter((tile) => holeAt(level, centreOfTile(tile)))).toEqual([]);
  });
});
