/**
 * Medium conformance: what every medium must do for the race to work, checked on every shipped
 * medium and on the test-only glide medium. Each is raced through `createWorld` and `stepWorld` on
 * the small inline courses `geometries.ts` lists for it: it is deterministic, caps speed (only
 * horizontal speed for media whose cases say so), honours its kick cooldown, shows every MoveModifiers
 * field, makes progress through its arena in each direction its own spec allows, sends a rival the
 * progress backstop catches into its own recovery, and gets every rival through each of its
 * geometries without stalling. A new medium joins by being in `MEDIA` (or registered here) and
 * listing its cases in `CASES_BY_MEDIUM`.
 */
import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../ai/profiles.ts';
import { PROGRESS_BACKSTOP_TICKS, rivalIntent } from '../ai/rival.ts';
import type { GameEvent } from '../events.ts';
import { effectiveTuning, MEDIA, registerMedium } from '../media/index.ts';
import type { Medium } from '../media/types.ts';
import { length } from '../num.ts';
import { COUNTDOWN_TICKS } from '../race/standings.ts';
import { centreOf, playerOf } from '../racers.ts';
import { hold, placeOnTile, racerOf, ticksOf } from '../test-world.ts';
import type { Intent, MoveModifiers, RivalProfile, Vec, World } from '../types.ts';
import { createWorld, stepWorld } from '../world.ts';
import { type Arena, CASES_BY_MEDIUM, courseIn, type MediumCases } from './geometries.ts';
import { GLIDE_MEDIUM } from './glide.ts';

registerMedium(GLIDE_MEDIUM);

const MEDIA_UNDER_TEST: readonly Medium[] = [...Object.values(MEDIA), GLIDE_MEDIUM];

/**
 * The cases `medium` is raced on.
 *
 * @throws {Error} When the medium has no entry in `CASES_BY_MEDIUM`.
 */
function casesFor(medium: Medium): MediumCases {
  const cases = CASES_BY_MEDIUM[medium.id];
  if (!cases) throw new Error(`Medium '${medium.id}' has no conformance cases; add it to CASES_BY_MEDIUM`);
  return cases;
}

/** Ticks a racer holds a direction in open space; it should cover at least half its cruise speed times that. */
const OPEN_SPACE_TICKS = 90;
/** Longest a rival may go without getting closer to the finish in a geometry: 2 s. */
const STALL_LIMIT_TICKS = 120;
/** Racing ticks a geometry race may take before it counts as not finishing: 60 s. */
const GEOMETRY_LIMIT_TICKS = 3600;

/** A world in `medium` on `ascii`, stepped through the countdown so the next step races. */
function racingWorld(medium: Medium, ascii: string, options: { seed?: number; playerBot?: RivalProfile } = {}) {
  const log = new EventLog<GameEvent>(100_000);
  const world = createWorld(courseIn(ascii, medium.id), log, {
    seed: options.seed ?? 1,
    endsWhen: 'everyone',
    ...options,
  });
  for (let i = 0; i <= COUNTDOWN_TICKS; i++) stepWorld(world, hold({ x: 0, y: 0 }), TICK_DT);
  return { world, log };
}

/** Every racer's body and the event stream after `ticks` of a bot-driven race on the medium's first geometry. */
function botRace(medium: Medium, ticks: number) {
  const first = casesFor(medium).geometries[0];
  if (!first) throw new Error(`Medium '${medium.id}' lists no geometries in CASES_BY_MEDIUM`);
  const { world, log } = racingWorld(medium, first.ascii, { playerBot: BOT_PROFILES.expert });
  for (let i = 0; i < ticks; i++) stepWorld(world, hold({ x: 0, y: 0 }), TICK_DT);
  return { bodies: world.racers.map((racer) => ({ ...racer.body })), events: log.all() };
}

/**
 * The player's speed after each of `ticks` steps holding `input`, on the axes the medium's
 * `speedCapAxes` says `maxSpeed` caps: only |vx| for media that fall under gravity, else the full speed.
 */
function speedsHolding(medium: Medium, world: World, input: Intent, ticks: number): number[] {
  const player = playerOf(world);
  const horizontalOnly = casesFor(medium).speedCapAxes === 'horizontal';
  return Array.from({ length: ticks }, () => {
    stepWorld(world, input, TICK_DT);
    return horizontalOnly ? Math.abs(player.body.vx) : length(player.body.vx, player.body.vy);
  });
}

/** A racing world on the medium's arena with the player put on `tile` and settled there. */
function playerInArena(medium: Medium, tile: (arena: Arena) => Vec) {
  const { arena } = casesFor(medium);
  const { world, log } = racingWorld(medium, arena.ascii);
  const player = playerOf(world);
  const at = tile(arena);
  placeOnTile(player, at.x, at.y);
  for (let i = 0; i < arena.settleTicks; i++) stepWorld(world, hold({ x: 0, y: 0 }), TICK_DT);
  return { world, log, player };
}

/** What one MoveModifiers field changes, read off the player after the medium moves it under `mods`. */
interface ModifierCase {
  field: keyof MoveModifiers;
  /** The field's value to compare against the medium's base. */
  changed: (base: MoveModifiers) => number;
  measure: (medium: Medium, mods: MoveModifiers) => number;
}

/** Applies the medium to the player in open space for `ticks`, with `intent` and `prepare` first; returns the player. */
function moveInOpen(
  medium: Medium,
  mods: MoveModifiers,
  ticks: number,
  intent: Intent,
  prepare = (_world: World) => {},
) {
  const { world, log, player } = playerInArena(medium, (arena) => arena.centre);
  prepare(world);
  const tuning = effectiveTuning(world);
  for (let i = 0; i < ticks; i++) {
    log.tick = i;
    medium.applyIntent(player, intent, medium.sampleEnvironment(world, player), tuning, mods, log, TICK_DT);
  }
  return { player, kicks: ticksOf(log, 'racer.kicked').length };
}

const MODIFIER_CASES: readonly ModifierCase[] = [
  {
    field: 'forceMul',
    changed: (base) => base.forceMul * 1.5,
    measure: (medium, mods) => moveInOpen(medium, mods, 30, hold({ x: 1, y: 0 })).player.body.vx,
  },
  {
    field: 'kickMul',
    changed: (base) => base.kickMul * 1.5,
    measure: (medium, mods) => {
      const { body } = moveInOpen(medium, mods, 1, hold({ x: 1, y: 0 }, { kick: true })).player;
      return body.vx;
    },
  },
  {
    field: 'kickCooldownTicks',
    changed: (base) => base.kickCooldownTicks * 2,
    measure: (medium, mods) => moveInOpen(medium, mods, 90, hold({ x: 1, y: 0 }, { kick: true })).kicks,
  },
  {
    field: 'dragMul',
    changed: (base) => base.dragMul * 2,
    measure: (medium, mods) => {
      const { body } = moveInOpen(medium, mods, casesFor(medium).arena.coastTicks, hold({ x: 0, y: 0 }), (world) => {
        playerOf(world).body.vx = 100;
      }).player;
      return body.vx;
    },
  },
];

/** Each racer's longest run of racing ticks without a new best progress, and whether it finished. */
function raceThrough(medium: Medium, ascii: string) {
  const { world } = racingWorld(medium, ascii, { playerBot: BOT_PROFILES.expert });
  const best = new Map(world.racers.map((racer) => [racer.id, { progress: racer.progress, since: 0, longest: 0 }]));
  for (let tick = 0; tick < GEOMETRY_LIMIT_TICKS && world.race.phase !== 'finished'; tick++) {
    stepWorld(world, hold({ x: 0, y: 0 }), TICK_DT);
    for (const racer of world.racers) {
      const record = best.get(racer.id);
      if (!record || racer.finished) continue;
      if (racer.progress < record.progress) Object.assign(record, { progress: racer.progress, since: 0 });
      else record.since++;
      record.longest = Math.max(record.longest, record.since);
    }
  }
  return world.racers.map((racer) => ({
    id: racer.id,
    finished: racer.finished !== null,
    longestStall: best.get(racer.id)?.longest ?? Number.NaN,
  }));
}

describe.each(MEDIA_UNDER_TEST.map((medium) => [medium.id, medium] as const))('the %s medium', (id, medium) => {
  it('races the same way twice from the same seed', () => {
    expect(botRace(medium, 300)).toEqual(botRace(medium, 300));
  });

  it('never goes faster than its speed cap, even pushed far past it', () => {
    const { world, player } = playerInArena(medium, (arena) => arena.runway);
    player.profile = { ...player.profile, forceMul: 6 };
    const top = Math.max(...speedsHolding(medium, world, hold({ x: 1, y: 0 }, { kick: true }), 90));
    const { maxSpeed } = effectiveTuning(world);

    expect(top).toBeLessThanOrEqual(maxSpeed + 1e-9);
    expect(top).toBeGreaterThan(maxSpeed * 0.95);
  });

  it('waits out its kick cooldown between kicks', () => {
    const { world, log } = playerInArena(medium, (arena) => arena.runway);
    for (let i = 0; i < 200; i++) {
      log.tick = world.tick + 1;
      stepWorld(world, hold({ x: 1, y: 0 }, { kick: true }), TICK_DT);
    }
    const playerKicks = log
      .all()
      .filter((event) => event.type === 'racer.kicked' && event.id === 'player')
      .map((event) => event.tick);
    const gaps = playerKicks.slice(1).map((tick, index) => tick - (playerKicks[index] ?? 0));

    expect(playerKicks.length).toBeGreaterThanOrEqual(3);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(effectiveTuning(world).base.kickCooldownTicks);
  });

  it.each(MODIFIER_CASES.map((modifier) => [modifier.field, modifier] as const))(
    'moves differently when %s changes',
    (field, modifier) => {
      const base = medium.tuning.base;
      const changed = { ...base, [field]: modifier.changed(base) };

      expect(modifier.measure(medium, changed)).not.toBeCloseTo(modifier.measure(medium, base), 3);
    },
  );

  const { directions, geometries } = CASES_BY_MEDIUM[id] ?? { directions: [], geometries: [] };
  it('lists the directions it moves in through open space', () => {
    expect(directions.length, `add '${id}' to CASES_BY_MEDIUM`).toBeGreaterThan(0);
  });

  it.each(directions.map((dir) => [dir.x.toFixed(2), dir.y.toFixed(2), dir] as const))(
    'makes progress through open space toward (%s, %s)',
    (_x, _y, dir) => {
      const { world, player } = playerInArena(medium, (arena) => arena.centre);
      const from = centreOf(player);
      for (let i = 0; i < OPEN_SPACE_TICKS; i++) stepWorld(world, hold(dir), TICK_DT);
      const to = centreOf(player);
      const { force, drag } = effectiveTuning(world);
      const halfCruiseDistance = 0.5 * (force / drag) * OPEN_SPACE_TICKS * TICK_DT;

      expect((to.x - from.x) * dir.x + (to.y - from.y) * dir.y).toBeGreaterThan(halfCruiseDistance);
    },
  );

  it('sends a rival the progress backstop catches into its own recovery, on that tick', () => {
    const { arena } = casesFor(medium);
    const { world } = racingWorld(medium, arena.ascii);
    const tess = racerOf(world, 'tess');
    const moves = Array.from({ length: PROGRESS_BACKSTOP_TICKS + 20 }, () => {
      placeOnTile(tess, 5, arena.centre.y);
      tess.body.vx = 60;
      tess.body.vy = 0;
      return rivalIntent(world, tess, world.rngs['ai.tess']).move;
    });
    const offCourse = moves.findIndex((move) => move.x < 0.5);

    // The first tick sets its best progress; the backstop fires once that many more pass without beating it.
    expect(offCourse).toBe(PROGRESS_BACKSTOP_TICKS);
  });

  it.each(geometries.map((geometry) => [geometry.name, geometry] as const))(
    'gets every rival through %s without stalling',
    (_name, geometry) => {
      const racers = raceThrough(medium, geometry.ascii);

      expect(racers.filter((racer) => !racer.finished).map((racer) => racer.id)).toEqual([]);
      expect(racers.filter((racer) => racer.longestStall >= STALL_LIMIT_TICKS)).toEqual([]);
    },
  );
});
