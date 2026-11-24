/**
 * Boost rings (`@`) in a flight race: never used up, each one boosts every racer once per race, and
 * the boost (`status.ringBoost`) makes a flyer faster while it lasts. Raced through `createWorld` on
 * small inline courses, where the rivals start in their own lane walled off above the player's.
 * Parsing `@` into `Level.rings` is `level/parse.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { flightWorld, RIVAL_LANE_ROWS } from '../media/flight/test-kit.ts';
import { modifiersFor } from '../modifiers.ts';
import { PASSIVE, RING } from '../powerups/tuning.ts';
import { activeRacers } from '../racers.ts';
import { eventsIn, hold, IDLE, placeOnTile, racerOf, step } from '../test-world.ts';
import { passRings } from './rings.ts';

/** Rings 0, 1 and 2 at cols 3, 4 and 7 of the player's second row, over the start and a rock floor. */
const RING_LINE = ['...........F', '...@@..@...F', '.1.........F', '###########F'];
const RING_ROW = RIVAL_LANE_ROWS + 1;
/** An open tile in the player's area, clear of every ring. */
const CLEAR = { x: 9, y: RIVAL_LANE_ROWS + 2 };

// Statuses tick at the end of the tick a ring is passed on, so one tick of the boost has already run.
const FULL_AFTER_PASS = RING.boostTicks - 1;

/** A flight race on `RING_LINE`. */
function ringRace() {
  return flightWorld(RING_LINE);
}

/** Puts the player on tile (tx, ty) and steps one idle tick. */
function passThrough(race: ReturnType<typeof ringRace>, tx: number, ty = RING_ROW): void {
  placeOnTile(race.player, tx, ty);
  step(race.world, race.log, 1, IDLE);
}

describe('passing a boost ring', () => {
  it('boosts a racer whose box overlaps the ring tile, and says which ring', () => {
    const race = ringRace();
    passThrough(race, 3);

    expect(race.player.status.ringBoost).toBe(FULL_AFTER_PASS);
    expect(race.world.ringsPassed.player).toEqual([0]);
    expect(eventsIn(race.log, 'ring.passed')).toEqual([{ type: 'ring.passed', id: 'player', ring: 0 }]);
  });

  it('does nothing when the same racer passes the same ring again', () => {
    const race = ringRace();
    passThrough(race, 3);
    passThrough(race, CLEAR.x, CLEAR.y);
    step(race.world, race.log, 10, IDLE);
    passThrough(race, 3);

    expect(race.player.status.ringBoost).toBe(FULL_AFTER_PASS - 12);
    expect(race.world.ringsPassed.player).toEqual([0]);
    expect(eventsIn(race.log, 'ring.passed')).toHaveLength(1);
  });

  it('refreshes the boost to full at the next ring in a line', () => {
    const race = ringRace();
    passThrough(race, 3);
    passThrough(race, CLEAR.x, CLEAR.y);
    step(race.world, race.log, 10, IDLE);
    passThrough(race, 7);

    expect(race.player.status.ringBoost).toBe(FULL_AFTER_PASS);
    expect(race.world.ringsPassed.player).toEqual([0, 2]);
    expect(eventsIn(race.log, 'ring.passed')).toEqual([
      { type: 'ring.passed', id: 'player', ring: 0 },
      { type: 'ring.passed', id: 'player', ring: 2 },
    ]);
  });

  it('boosts another racer passing a ring someone already passed', () => {
    const race = ringRace();
    const tess = racerOf(race.world, 'tess');
    passThrough(race, 3);
    placeOnTile(race.player, CLEAR.x, CLEAR.y);
    placeOnTile(tess, 3, RING_ROW);
    step(race.world, race.log, 1, IDLE);

    expect(tess.status.ringBoost).toBe(FULL_AFTER_PASS);
    expect(race.world.ringsPassed.tess).toEqual([0]);
    expect(eventsIn(race.log, 'ring.passed')).toEqual([
      { type: 'ring.passed', id: 'player', ring: 0 },
      { type: 'ring.passed', id: 'tess', ring: 0 },
    ]);
  });
});

describe('a racer out of the race', () => {
  it('is not boosted by a ring once finished', () => {
    const race = ringRace();
    race.player.finished = { tick: 0, place: 1, overshoot: 0 };
    passThrough(race, 3);

    expect(race.player.status.ringBoost).toBe(0);
    expect(eventsIn(race.log, 'ring.passed')).toEqual([]);
  });

  it('is not boosted by a ring while fallen', () => {
    const race = ringRace();
    // Through stepWorld a fallen racer is held below the level, so the pickups slot is called directly.
    placeOnTile(race.player, 3, RING_ROW);
    race.player.status.fallen = 30;
    passRings(race.world, activeRacers(race.world));

    expect(race.player.status.ringBoost).toBe(0);
    expect(race.world.ringsPassed.player).toEqual([]);
    expect(eventsIn(race.log, 'ring.passed')).toEqual([]);
  });
});

describe('the ring boost', () => {
  it('multiplies forceMul by ringBoostForceMul, so a flyer holding right goes faster', () => {
    const boosted = ringRace();
    const plain = flightWorld(RING_LINE.map((row) => row.replaceAll('@', '.')));
    const forceMul = (race: ReturnType<typeof ringRace>) => modifiersFor(race.world, race.player).forceMul;
    for (const race of [boosted, plain]) placeOnTile(race.player, 1, RING_ROW + 1);
    const plainForceMul = forceMul(plain);
    boosted.player.status.ringBoost = RING.boostTicks;

    expect(forceMul(boosted)).toBeCloseTo(plainForceMul * PASSIVE.ringBoostForceMul, 10);
    for (const race of [boosted, plain]) step(race.world, race.log, 40, hold({ x: 1, y: 0 }));
    expect(boosted.player.body.vx).toBeGreaterThan(plain.player.body.vx);
    expect(boosted.player.body.x).toBeGreaterThan(plain.player.body.x);
  });

  it('counts down with the other statuses and then stops making the flyer faster', () => {
    const race = ringRace();
    const baseForceMul = modifiersFor(race.world, race.player).forceMul;
    passThrough(race, 3);
    passThrough(race, CLEAR.x, CLEAR.y);
    const afterTwoTicks = race.player.status.ringBoost;
    step(race.world, race.log, RING.boostTicks, IDLE);

    expect(afterTwoTicks).toBe(RING.boostTicks - 2);
    expect(race.player.status.ringBoost).toBe(0);
    expect(modifiersFor(race.world, race.player).forceMul).toBe(baseForceMul);
  });
});
