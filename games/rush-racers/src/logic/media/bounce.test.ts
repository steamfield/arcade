/**
 * The bounce cloud seam: a bounce cloud (`B`) is a wall in every medium's navigation and in the
 * progress field, and only a medium with `effects.bounceSpeed` may race a level with one. How a
 * racer springs off it is `race/bounce.test.ts`.
 */
import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { GLIDE_MEDIUM } from '../conformance/glide.ts';
import { PLATFORM_MEDIUM } from '../conformance/platform-medium.ts';
import type { GameEvent } from '../events.ts';
import { LevelError, parseLevel } from '../level/parse.ts';
import { buildProgressField, fieldAt } from '../race/flowfield.ts';
import { courseFromLevel } from '../test-world.ts';
import { createWorld, toAscii } from '../world.ts';
import { flightWorld, RIVAL_LANE_ROWS } from './flight/test-kit.ts';
import { MEDIA, registerMedium } from './index.ts';

registerMedium(GLIDE_MEDIUM);

/** A level whose middle row has a bounce cloud at row 1, col 5, beside an open tile at col 4. */
const CLOUDY = `
  #########
  #1...B.F#
  #2.....F#
  #3.....F#
  #4.....F#
  #########
`;

/** The LevelError `createWorld` throws for `CLOUDY` in `medium`; any other outcome fails the test. */
function levelErrorIn(medium: string): LevelError {
  try {
    createWorld(courseFromLevel(CLOUDY, medium), new EventLog<GameEvent>(100), { seed: 1 });
  } catch (error) {
    if (error instanceof LevelError) return error;
    throw error;
  }
  throw new Error(`createWorld raced a bounce cloud in medium '${medium}'`);
}

describe('a medium without bounce clouds', () => {
  it.each(['swim', 'run', 'glide'])('rejects a %s course with one, at its row and col', (medium) => {
    expect(levelErrorIn(medium)).toMatchObject({
      message: expect.stringMatching(
        new RegExp(`^Bounce cloud "B" at row 1, col 5: medium '${medium}' has no bounce clouds`),
      ),
      row: 1,
      col: 5,
    });
  });

  it('says which media have bounce clouds: flight only, at 300 px/s to start', () => {
    const speeds = [...Object.values(MEDIA), GLIDE_MEDIUM, PLATFORM_MEDIUM].map((medium) => [
      medium.id,
      medium.effects.bounceSpeed,
    ]);
    expect(speeds).toEqual([
      ['swim', null],
      ['run', null],
      ['flight', 300],
      ['drift', null],
      ['glide', null],
      ['platform', null],
    ]);
  });
});

describe('a bounce cloud in navigation', () => {
  const level = parseLevel({ name: 'cloudy', ascii: CLOUDY });
  const cloud = { x: 5, y: 1 };
  const open = { x: 4, y: 1 };
  const right = { x: 1, y: 0 };

  it.each([...Object.values(MEDIA), GLIDE_MEDIUM].map((medium) => [medium.id, medium] as const))(
    'is closed to %s like rock, while the open tile beside it is not',
    (_, medium) => {
      expect(medium.enterCost('bounce', false, right, cloud, level)).toBe(Number.POSITIVE_INFINITY);
      expect(medium.enterCost('rock', false, right, cloud, level)).toBe(Number.POSITIVE_INFINITY);
      expect(medium.enterCost('water', false, right, open, level)).toBeLessThan(Number.POSITIVE_INFINITY);
    },
  );

  it('is closed in the progress field', () => {
    const progress = buildProgressField(level);
    expect(fieldAt(progress.distance, progress, cloud)).toBe(Number.POSITIVE_INFINITY);
    expect(fieldAt(progress.distance, progress, open)).toBeLessThan(Number.POSITIVE_INFINITY);
  });

  it("is closed in a flight race's nav, which a rival reads", () => {
    const { world } = flightWorld(['#1...BB...F', '#.........F', '###########']);
    const flight = MEDIA.flight;
    const row = RIVAL_LANE_ROWS;

    expect(flight.distanceAt(world, { x: 5, y: row })).toBe(Number.POSITIVE_INFINITY);
    expect(flight.distanceAt(world, { x: 4, y: row })).toBeLessThan(Number.POSITIVE_INFINITY);
    expect(flight.nextTile(world, { x: 4, y: row })).not.toEqual({ x: 1, y: 0 });
  });
});

describe('a bounce cloud in a flight race', () => {
  it('is raced and prints as B', () => {
    const { world } = flightWorld(['#1...BB...F', '#.........F', '###########']);

    expect(toAscii(world).split('\n')[RIVAL_LANE_ROWS]).toBe('#@...BB...F');
  });
});

describe("flight's enterCost", () => {
  it('charges what its nav does, low tiles over open sky included', () => {
    // Column 1's last row is open sky; column 2's is rock.
    const level = parseLevel({
      name: 'gap',
      ascii: ['#1234...F', '#.......F', '#.......F', '#.......F', '#.......F', '#.#######'].join('\n'),
    });
    const cost = (x: number, y: number) => MEDIA.flight.enterCost('water', false, { x: 1, y: 0 }, { x, y }, level);

    expect(cost(1, 4)).toBeGreaterThan(cost(2, 4));
    expect(cost(1, 1)).toBe(cost(2, 4));
  });
});
