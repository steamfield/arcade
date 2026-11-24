/**
 * Flight rivals and the sky's set pieces: they fly through a ring line their way runs near and finish
 * no slower for it, even reading the way only every 30 ticks from above it; they drop onto a bounce cloud at the foot of a tall wall and top it sooner than by
 * flapping, without bouncing in place; and they read lightning: wait short of a storm zone they can't
 * cross before the strike, cross one they can, queue behind one another at a zone without shoving the
 * one ahead into the strike, and on sky-test the expert is hardly ever struck and no rival waits a
 * whole period. Raced through `createWorld` on inline skies (`rival-test-kit.ts`) and on sky-test.
 */
import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../../ai/profiles.ts';
import { courseById } from '../../courses/index.ts';
import type { GameEvent } from '../../events.ts';
import { lightningPhase } from '../../hazards/lightning.ts';
import { IDLE, racerOf } from '../../test-world.ts';
import { type LightningZone, type Racer, type RacerId, type RivalProfile, TILE, type World } from '../../types.ts';
import { createWorld, stepWorld } from '../../world.ts';
import { benchRace, centre, columnOf, raceUntilFinished, STEADY_FLYER } from './rival-test-kit.ts';

/** An open row of a sky 50 tiles wide. */
const OPEN = `#${'.'.repeat(48)}F`;
/** A thunderhead ceiling or floor 50 tiles wide. */
const ROCK = '#'.repeat(50);

/** Ticks a rival gets to finish an inline sky. */
const FINISH_LIMIT = 1200;
/** A reactionTicks long enough that the rival reaches the point it flies at well before it reads the way again. */
const LATE_READ_TICKS = 30;

/** An open row 50 tiles wide with `glyphs` (by column) placed in it. */
function openWith(glyphs: Record<number, string>): string {
  return [...OPEN].map((ch, col) => glyphs[col] ?? ch).join('');
}

describe('flight rivals and ring lines', () => {
  /** Open sky with tess (2) on row 6 and a line of six rings stepping off her way by up to 2 rows. */
  const RINGED = [
    ROCK,
    OPEN,
    OPEN,
    OPEN,
    openWith({ 15: '@' }),
    openWith({ 12: '@', 18: '@' }),
    openWith({ 2: '2', 21: '@' }),
    openWith({ 24: '@' }),
    openWith({ 27: '@' }),
    OPEN,
    OPEN,
    ROCK,
  ];

  /** tess's finish tick and the rings she passed on `area`, flying as STEADY_FLYER with `profile` on top. */
  function ringRun(area: readonly string[], profile: Partial<RivalProfile> = {}) {
    const { world, log } = benchRace(area, { tess: { ...STEADY_FLYER, ...profile } });
    raceUntilFinished(world, log, ['tess'], FINISH_LIMIT);
    const passed = log.all().filter((event) => event.type === 'ring.passed' && event.id === 'tess');
    return {
      finish: racerOf(world, 'tess').finished?.tick ?? null,
      passed: passed.length,
      rings: world.level.rings.length,
    };
  }

  it('flies through a ring line its way runs within 2 tiles of, and finishes no slower than without the rings', () => {
    const ringed = ringRun(RINGED);
    const plain = ringRun(RINGED.map((row) => row.replaceAll('@', '.')));

    expect(ringed.rings).toBe(6);
    expect(ringed.passed).toBeGreaterThanOrEqual(ringed.rings - 1);
    expect(ringed.finish).not.toBeNull();
    expect(ringed.finish ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(plain.finish ?? 0);
  });

  it('flies through the ring line from above reading the way only every 30 ticks, easing to each ring rather than past it', () => {
    const fromAbove = RINGED.map((row, index) => (index === 3 ? openWith({ 2: '2' }) : row.replace('2', '.')));
    const late = ringRun(fromAbove, { reactionTicks: LATE_READ_TICKS });

    expect(late.passed).toBeGreaterThanOrEqual(late.rings - 1);
  });
});

describe('flight rivals and bounce clouds', () => {
  /** Row of the wall's top: the rival has climbed it once its body is above this row. */
  const WALL_TOP_ROW = 3;
  /** The bounce cloud's column, at the foot of the wall. */
  const CLOUD_COL = 13;

  /** A thunderhead wall (cols 14-15) from row 3 to the floor, with `foot` in the floor at its foot (col 13) and tess (2) beside it. */
  function wallWith(foot: 'B' | '#'): string[] {
    const open = `#${'.'.repeat(28)}F`;
    const walled = `#${'.'.repeat(13)}##${'.'.repeat(13)}F`;
    return [
      '#'.repeat(30),
      open,
      open,
      ...Array.from({ length: 11 }, () => walled),
      `#...........2.##${'.'.repeat(13)}F`,
      `${'#'.repeat(CLOUD_COL)}${foot}${'#'.repeat(16)}`,
    ];
  }

  /** Ticks tess takes to get above the wall, and her bounces before she is past the cloud's column. */
  function climb(foot: 'B' | '#') {
    const { world, log } = benchRace(wallWith(foot), { tess: STEADY_FLYER });
    const tess = racerOf(world, 'tess');
    let toppedAt: number | null = null;
    let pastAt: number | null = null;
    raceUntilFinished(world, log, ['tess'], FINISH_LIMIT, (tick) => {
      if (toppedAt === null && tess.body.y + tess.body.h <= WALL_TOP_ROW * TILE) toppedAt = tick;
      if (pastAt === null && columnOf(centre(tess).x) > CLOUD_COL) pastAt = world.tick;
    });
    const bouncesBeforePast = log
      .all()
      .filter(
        (event) =>
          event.type === 'racer.bounced' && event.id === 'tess' && event.tick <= (pastAt ?? Number.POSITIVE_INFINITY),
      ).length;
    return { toppedAt, bouncesBeforePast, finished: tess.finished !== null };
  }

  it('lands on a bounce cloud at the foot of a tall wall and tops it sooner than by flapping, bouncing at most twice', () => {
    const bounced = climb('B');
    const flapped = climb('#');

    expect(bounced.bouncesBeforePast).toBeGreaterThanOrEqual(1);
    expect(bounced.bouncesBeforePast).toBeLessThanOrEqual(2);
    expect(bounced.toppedAt).not.toBeNull();
    expect(bounced.toppedAt ?? Number.POSITIVE_INFINITY).toBeLessThan(flapped.toppedAt ?? 0);
    expect([bounced.finished, flapped.finished]).toEqual([true, true]);
  });
});

describe('flight rivals and lightning', () => {
  /** Open sky with tess (2) on row 4, flying right through the zone. */
  const STORMY = [ROCK, OPEN, OPEN, OPEN, `#.2${'.'.repeat(46)}F`, OPEN, OPEN, OPEN, ROCK];
  /** Ten columns wide, warning when tess is still short of it: she can't cross before the strike. */
  const WIDE: LightningZone = { cols: [20, 29], periodTicks: 300, offsetTicks: 83 };
  /** Two columns wide, warning when tess is about to reach it: she clears it before the strike. */
  const NARROW: LightningZone = { cols: [20, 21], periodTicks: 300, offsetTicks: 78 };

  /** What tess did at `zone`: when her hitbox first entered its columns, how she met the strikes, and her longest wait before it. */
  function crossing(zone: LightningZone) {
    const { world, log } = benchRace(STORMY, { tess: STEADY_FLYER }, { lightning: [zone] });
    const tess = racerOf(world, 'tess');
    let enteredAt: number | null = null;
    let firstStrikeAt: number | null = null;
    let inZoneDuringStrike = 0;
    let waited = 0;
    raceUntilFinished(world, log, ['tess'], FINISH_LIMIT, () => {
      const phase = lightningPhase(zone, world.race.raceTick);
      const inZone = overlapsColumns(tess, zone);
      if (phase === 'strike') firstStrikeAt ??= world.race.raceTick;
      if (inZone && enteredAt === null) enteredAt = world.race.raceTick;
      if (inZone && phase === 'strike') inZoneDuringStrike++;
      if (enteredAt === null && waitingBefore(tess, zone)) waited++;
    });
    const struck = log
      .all()
      .filter((event) => event.type === 'racer.hit' && event.id === 'tess' && event.cause === 'lightning').length;
    const enteredIn = enteredAt === null ? null : lightningPhase(zone, enteredAt);
    return {
      enteredAt,
      enteredIn,
      firstStrikeAt,
      inZoneDuringStrike,
      struck,
      waited,
      finished: tess.finished !== null,
    };
  }

  it('waits short of a zone warning when it cannot cross before the strike, and crosses once the strike ends', () => {
    const wide = crossing(WIDE);

    expect(wide).toMatchObject({ struck: 0, inZoneDuringStrike: 0, enteredIn: 'calm', finished: true });
    expect(wide.enteredAt ?? 0).toBeGreaterThan(wide.firstStrikeAt ?? Number.POSITIVE_INFINITY);
    expect(wide.waited).toBeGreaterThan(0);
    expect(wide.waited).toBeLessThan(WIDE.periodTicks);
  });

  it('crosses a zone that is warning when, at its speed, it clears the columns before the strike', () => {
    const narrow = crossing(NARROW);

    expect(narrow).toMatchObject({ struck: 0, inZoneDuringStrike: 0, enteredIn: 'warning', finished: true });
  });

  it.each([
    ['a slower rival ahead of a faster one', { tess: 0.6, squib: 1.6 }],
    ['two rivals at one speed', { tess: 1, squib: 1 }],
  ])(
    'in a one-row tunnel, %s queue at a storm zone: whenever it strikes, neither is struck nor shoved in',
    (_, forceMul) => {
      const queued = QUEUE_OFFSETS.map((offsetTicks) => ({ offsetTicks, ...queueAtStorm(forceMul, offsetTicks) }));

      expect(queued.filter((race) => race.struck > 0 || race.bumps > 2 || !race.finished)).toEqual([]);
    },
  );

  it('on sky-test seeds 1-5 on Hard, expert flyers are struck at most once a race and no rival waits a whole period', () => {
    const races = [1, 2, 3, 4, 5].map((seed) => ({ seed, ...skyTestStorm(seed) }));

    expect(races.filter((race) => race.expertStrikes > 1)).toEqual([]);
    expect(races.filter((race) => race.longestWait >= race.periodTicks)).toEqual([]);
  });
});

/** A tunnel one row high, tess (2) ahead of squib (3), with no room for either to pass the other. */
const ONE_ROW_TUNNEL = [ROCK, `#.3....2${'.'.repeat(41)}F`, ROCK];
/** Every tenth tick of a 300-tick storm period: when the zone ahead of the queue strikes. */
const QUEUE_OFFSETS = Array.from({ length: 30 }, (_, index) => index * 10);

/**
 * tess and squib (steady, with these force multipliers) through ONE_ROW_TUNNEL with a storm zone over
 * cols 30-34 striking every 300 ticks from `offsetTicks`: lightning hits on either, bumps between
 * them, and whether both finished.
 */
function queueAtStorm(forceMul: { tess: number; squib: number }, offsetTicks: number) {
  const zone: LightningZone = { cols: [30, 34], periodTicks: 300, offsetTicks };
  const profiles = {
    tess: { ...STEADY_FLYER, forceMul: forceMul.tess },
    squib: { ...STEADY_FLYER, forceMul: forceMul.squib },
  };
  const { world, log } = benchRace(ONE_ROW_TUNNEL, profiles, { lightning: [zone] });
  raceUntilFinished(world, log, ['tess', 'squib'], FINISH_LIMIT);
  const events = log.all();
  const struck = events.filter(
    (event) =>
      event.type === 'racer.hit' && event.cause === 'lightning' && (event.id === 'tess' || event.id === 'squib'),
  ).length;
  const bumps = events.filter(
    (event) => event.type === 'racer.bumped' && [event.a, event.b].sort().join() === 'squib,tess',
  ).length;
  return {
    struck,
    bumps,
    finished: racerOf(world, 'tess').finished !== null && racerOf(world, 'squib').finished !== null,
  };
}

/** Whether the racer's box overlaps the zone's columns at any height. */
function overlapsColumns(racer: Racer, zone: LightningZone): boolean {
  return racer.body.x < (zone.cols[1] + 1) * TILE && racer.body.x + racer.body.w > zone.cols[0] * TILE;
}

/** Tiles before a storm zone in which a racer that isn't moving on counts as waiting at it. */
const WAIT_BAND_TILES = 3;

/** Whether the racer is short of the zone's columns, within WAIT_BAND_TILES of them, coming from the left. */
function waitingBefore(racer: Racer, zone: LightningZone): boolean {
  const right = racer.body.x + racer.body.w;
  return right <= zone.cols[0] * TILE && right > (zone.cols[0] - WAIT_BAND_TILES) * TILE;
}

/**
 * Two sky-test races on Hard with the expert bot as the player: one with every rival flying the
 * expert's profile (counting lightning hits on all four), one with the rivals as drawn (the longest
 * run of ticks any rival spends waiting just short of the storm zone).
 *
 * @throws {Error} When sky-test is missing or has no storm zone.
 */
function skyTestStorm(seed: number): { expertStrikes: number; longestWait: number; periodTicks: number } {
  const course = courseById('sky-test');
  const zone = course?.level.lightning?.[0];
  if (!course || !zone) throw new Error('sky-test must exist and have a storm zone');
  const expert = raceSkyTest(seed, true);
  const expertStrikes = expert.log
    .all()
    .filter((event) => event.type === 'racer.hit' && event.cause === 'lightning').length;
  const drawn = raceSkyTest(seed, false);
  return { expertStrikes, longestWait: Math.max(...Object.values(drawn.waits)), periodTicks: zone.periodTicks };

  function raceSkyTest(raceSeed: number, expertRivals: boolean) {
    if (!course || !zone) throw new Error('sky-test must exist and have a storm zone');
    const log = new EventLog<GameEvent>(100_000);
    const world: World = createWorld(course, log, {
      seed: raceSeed,
      difficulty: 'hard',
      playerBot: BOT_PROFILES.expert,
      endsWhen: 'everyone',
    });
    const rivalIds: RacerId[] = ['tess', 'squib', 'bo'];
    if (expertRivals) {
      for (const id of rivalIds) {
        const rival = racerOf(world, id);
        const { kickSkill, wobble, reactionTicks } = BOT_PROFILES.expert;
        rival.profile = { ...rival.profile, kickSkill, wobble, reactionTicks };
      }
    }
    const waits = Object.fromEntries(rivalIds.map((id) => [id, 0])) as Record<RacerId, number>;
    const streaks = { ...waits };
    for (let tick = 0; tick < 4000 && world.race.phase !== 'finished'; tick++) {
      log.tick = world.tick + 1;
      stepWorld(world, IDLE, TICK_DT);
      for (const id of rivalIds) {
        streaks[id] = waitingBefore(racerOf(world, id), zone) ? streaks[id] + 1 : 0;
        waits[id] = Math.max(waits[id], streaks[id]);
      }
    }
    return { log, waits };
  }
}
