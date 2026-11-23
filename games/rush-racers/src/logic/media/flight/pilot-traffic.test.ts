/**
 * Flight rivals in traffic: a faster rival that catches a slower one ahead goes over or under it and
 * on past within 3 s, in open sky and in a tunnel two rows high, and both keep racing; in a tunnel
 * one row high, where there is no room to pass, it follows a little behind instead of bumping or
 * pushing the slower one. Squib (faster) starts behind tess (slower) on inline skies with the player and bo benched.
 */
import { describe, expect, it } from 'vitest';
import { racerOf } from '../../test-world.ts';
import { RACER_SIZE, TILE } from '../../types.ts';
import { benchRace, centre, raceUntilFinished, STEADY_FLYER } from './rival-test-kit.ts';

/** Ticks in 3 s. */
const PASS_TICKS = 180;
/** Centre-to-centre px behind the slower rival at which the faster one has caught it. */
const CAUGHT_PX = 2 * TILE;
/** Px between two boxes side by side that still counts as touching. */
const TOUCH_PX = 1;
/** Ticks a follower may spend touching the racer it follows: a brief brush, not a push. */
const MOST_TOUCHING_TICKS = 30;
/** Ticks both rivals get to finish; flown clean, the slower one needs well under half of this. */
const FINISH_LIMIT = 1800;

/** The slower rival ahead and the faster one behind it. */
const SLOW = { ...STEADY_FLYER, forceMul: 0.6 };
const FAST = { ...STEADY_FLYER, forceMul: 1.6 };

/** Open sky nine rows high: squib (3) starts 5 tiles behind tess (2) on row 5. */
const OPEN_SKY = [
  '#'.repeat(60),
  ...Array.from({ length: 4 }, () => `#${'.'.repeat(58)}F`),
  `#.3....2${'.'.repeat(51)}F`,
  ...Array.from({ length: 4 }, () => `#${'.'.repeat(58)}F`),
];

/** A tunnel two rows high between thunderheads, the rivals on its lower row. */
const TWO_ROW_TUNNEL = ['#'.repeat(60), `#${'.'.repeat(58)}F`, `#.3....2${'.'.repeat(51)}F`, '#'.repeat(60)];

/** A tunnel one row high: too low for one flyer to pass another. */
const ONE_ROW_TUNNEL = ['#'.repeat(60), `#.3....2${'.'.repeat(51)}F`, '#'.repeat(60)];

/**
 * Races squib (fast) behind tess (slow) on `area` until both finish, and reports when squib caught
 * tess, when it got past her, the height between them as it drew level, and the bumps between them.
 */
function chase(area: readonly string[]) {
  const { world, log } = benchRace(area, { tess: SLOW, squib: FAST });
  const tess = racerOf(world, 'tess');
  const squib = racerOf(world, 'squib');
  let caughtAt: number | null = null;
  let passedAt: number | null = null;
  let heightWhenLevel: number | null = null;
  let touchingTicks = 0;
  raceUntilFinished(world, log, ['tess', 'squib'], FINISH_LIMIT, (tick) => {
    const behind = centre(tess).x - centre(squib).x;
    if (Math.abs(behind) <= RACER_SIZE.width + TOUCH_PX && tess.finished === null) touchingTicks++;
    if (caughtAt === null && behind <= CAUGHT_PX) caughtAt = tick;
    if (heightWhenLevel === null && behind <= 0) heightWhenLevel = Math.abs(centre(tess).y - centre(squib).y);
    if (passedAt === null && behind < -RACER_SIZE.width) passedAt = tick;
  });
  const bumps = log.all().filter((event) => event.type === 'racer.bumped' && event.a === 'tess' && event.b === 'squib');
  return {
    caughtAt,
    passedAt,
    heightWhenLevel,
    bumps: bumps.length,
    touchingTicks,
    finished: [tess.finished !== null, squib.finished !== null],
  };
}

describe('flight rivals in traffic', () => {
  it.each([
    ['open sky', OPEN_SKY],
    ['a tunnel two rows high', TWO_ROW_TUNNEL],
  ])('in %s, a faster rival goes over or under a slower one and past it within 3 s of catching it', (_, area) => {
    const { caughtAt, passedAt, heightWhenLevel, finished } = chase(area);

    expect(caughtAt).not.toBeNull();
    expect(passedAt).not.toBeNull();
    expect((passedAt ?? Number.POSITIVE_INFINITY) - (caughtAt ?? 0)).toBeLessThanOrEqual(PASS_TICKS);
    expect(heightWhenLevel).toBeGreaterThanOrEqual(RACER_SIZE.height);
    expect(finished).toEqual([true, true]);
  });

  it('in a tunnel one row high, the faster rival follows the slower one without bumping it over and over', () => {
    const { passedAt, bumps, touchingTicks, finished } = chase(ONE_ROW_TUNNEL);

    expect(passedAt).toBeNull();
    expect(bumps).toBeLessThanOrEqual(2);
    expect(touchingTicks).toBeLessThanOrEqual(MOST_TOUCHING_TICKS);
    expect(finished).toEqual([true, true]);
  });
});
