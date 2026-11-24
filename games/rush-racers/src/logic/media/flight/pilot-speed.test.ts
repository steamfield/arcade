/**
 * How fast a flight rival flies along an open straight: at its own cruise (its share of forceMul,
 * so a profile, catch-up or ring boost over 1 shows), carried on by a tailwind, and without easing
 * off at each waypoint when it reads the way late, though still steering round a spark cloud by its
 * line. Raced through `createWorld` on small inline skies with the other racers benched below; its
 * own cruise is read each tick from its modifiers, since catch-up moves them as it pulls ahead of the
 * benched player.
 */
import { describe, expect, it } from 'vitest';
import { modifiersFor } from '../../modifiers.ts';
import { racerOf } from '../../test-world.ts';
import type { RivalProfile } from '../../types.ts';
import { forceScale } from './cruise.ts';
import { benchRace, raceUntilFinished } from './rival-test-kit.ts';
import { FLIGHT_TUNING } from './tuning.ts';

const { cruise, windSpeed } = FLIGHT_TUNING.extra;

/** Ticks it is given to get up to speed before its speed is read. */
const SETTLE_TICKS = 90;
/** Ticks its speed is averaged over. */
const SAMPLE_TICKS = 120;

/** Open sky three rows high and 70 tiles long, tess starting on the middle row; `fill` fills the open cells. */
function straight(fill: '.' | '>'): string[] {
  const open = fill.repeat(68);
  return ['#'.repeat(70), `#${open}F`, `#2${open.slice(1)}F`, `#${open}F`];
}

/** A reactionTicks long enough that the rival reaches its waypoint well before it reads the way again. */
const LATE_READ_TICKS = 30;
/** Open sky five rows high and 50 tiles long, tess starting on row 2 with a spark cloud against the ceiling just above her line, 19 tiles ahead. */
const SPARKED = (() => {
  const open = `#${'.'.repeat(48)}F`;
  return [
    '#'.repeat(50),
    `#${'.'.repeat(19)}*${'.'.repeat(28)}F`,
    `#2${'.'.repeat(47)}F`,
    open,
    open,
    open,
    '#'.repeat(50),
  ];
})();
/** Ticks tess gets to finish the straight. */
const FINISH_LIMIT = 1200;

/** A profile strong enough that even held back by catch-up, its own cruise is over the base cruise. */
const STRONG = 2.5;

/**
 * Tess's mean horizontal speed and mean own cruise (`cruise` times her share of forceMul), px/s, over
 * SAMPLE_TICKS after SETTLE_TICKS on `area`, flying with `profile`.
 */
function speeds(area: string[], profile: Partial<RivalProfile>): { flown: number; ownCruise: number } {
  const { world, log } = benchRace(area, { tess: { wobble: 0, reactionTicks: 2, kickSkill: 0, ...profile } });
  const tess = racerOf(world, 'tess');
  let flown = 0;
  let ownCruise = 0;
  raceUntilFinished(world, log, ['tess'], SETTLE_TICKS + SAMPLE_TICKS, (tick) => {
    if (tick <= SETTLE_TICKS) return;
    flown += tess.body.vx / SAMPLE_TICKS;
    ownCruise += (cruise * forceScale(modifiersFor(world, tess))) / SAMPLE_TICKS;
  });
  return { flown, ownCruise };
}

describe('a flight rival on an open straight', () => {
  it('flies at its own cruise when its forceMul puts that over the base cruise', () => {
    const { flown, ownCruise } = speeds(straight('.'), { forceMul: STRONG });

    expect(ownCruise).toBeGreaterThan(cruise + 10);
    expect(flown).toBeCloseTo(ownCruise, -1);
  });

  it('rides a tailwind at its own cruise plus the wind', () => {
    const { flown, ownCruise } = speeds(straight('>'), {});

    expect(flown).toBeCloseTo(ownCruise + windSpeed, -1);
  });

  it('keeps flying through waypoints at its own cruise when it reads the way only every 30 ticks', () => {
    const { flown, ownCruise } = speeds(straight('.'), { forceMul: STRONG, reactionTicks: LATE_READ_TICKS });

    expect(flown).toBeCloseTo(ownCruise, -1);
  });

  it('still steers round a spark cloud just above its line when it reads the way only every 30 ticks, never stunned', () => {
    const { world, log } = benchRace(SPARKED, { tess: { wobble: 0, kickSkill: 0, reactionTicks: LATE_READ_TICKS } });
    raceUntilFinished(world, log, ['tess'], FINISH_LIMIT);

    expect(racerOf(world, 'tess').finished).not.toBeNull();
    expect(log.all().filter((event) => event.type === 'racer.stunned' && event.id === 'tess')).toEqual([]);
  });
});
