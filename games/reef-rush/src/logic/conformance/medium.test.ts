/**
 * Medium conformance: what every medium must do for the race to work, checked on every shipped
 * medium and on the test-only glide medium. Each is raced through `createWorld` and `stepWorld` on
 * small inline courses (`geometries.ts`): it is deterministic, caps speed, honours its kick
 * cooldown, shows every MoveModifiers field, makes progress in open space in each direction its
 * own spec allows, and gets every rival through an overhang, a 1-tile gap, a shaft with a lip and a
 * drop without stalling. A new medium joins by being in `MEDIA` (or registered here) and listing its
 * open-space directions below.
 */
import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../ai/profiles.ts';
import type { GameEvent } from '../events.ts';
import { MEDIA, registerMedium } from '../media/index.ts';
import type { Medium } from '../media/types.ts';
import { length } from '../num.ts';
import { COUNTDOWN_TICKS } from '../race/standings.ts';
import { centreOf, playerOf } from '../racers.ts';
import { hold, placeOnTile, ticksOf } from '../test-world.ts';
import { type Intent, type MoveModifiers, type RivalProfile, TILE, type Vec, type World } from '../types.ts';
import { createWorld, stepWorld } from '../world.ts';
import { courseIn, GEOMETRIES, OPEN_ARENA } from './geometries.ts';
import { GLIDE_MEDIUM } from './glide.ts';

registerMedium(GLIDE_MEDIUM);

const MEDIA_UNDER_TEST: readonly Medium[] = [...Object.values(MEDIA), GLIDE_MEDIUM];

const EIGHT_WAYS: readonly Vec[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
  { x: Math.SQRT1_2, y: Math.SQRT1_2 },
  { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
  { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
];

/** The directions each medium's own spec says a racer moves freely in through open space. */
const OPEN_SPACE_DIRECTIONS: Readonly<Record<string, readonly Vec[]>> = {
  swim: EIGHT_WAYS,
  glide: EIGHT_WAYS,
};

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

/** Every racer's body and the event stream after `ticks` of a bot-driven race on the first geometry. */
function botRace(medium: Medium, ticks: number) {
  const { world, log } = racingWorld(medium, GEOMETRIES[0]?.ascii ?? '', { playerBot: BOT_PROFILES.expert });
  for (let i = 0; i < ticks; i++) stepWorld(world, hold({ x: 0, y: 0 }), TICK_DT);
  return { bodies: world.racers.map((racer) => ({ ...racer.body })), events: log.all() };
}

/** The player's speed after each of `ticks` steps holding `input`. */
function speedsHolding(world: World, input: Intent, ticks: number): number[] {
  const player = playerOf(world);
  return Array.from({ length: ticks }, () => {
    stepWorld(world, input, TICK_DT);
    return length(player.body.vx, player.body.vy);
  });
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
  const { world, log } = racingWorld(medium, OPEN_ARENA);
  const player = playerOf(world);
  placeOnTile(player, 14, 6);
  prepare(world);
  for (let i = 0; i < ticks; i++) {
    log.tick = i;
    medium.applyIntent(player, intent, medium.sampleEnvironment(world, player), mods, log, TICK_DT);
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
      const { body } = moveInOpen(medium, mods, 30, hold({ x: 0, y: 0 }), (world) => {
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
    const { world } = racingWorld(medium, OPEN_ARENA);
    const player = playerOf(world);
    placeOnTile(player, 2, 6);
    player.profile = { ...player.profile, forceMul: 6 };
    const top = Math.max(...speedsHolding(world, hold({ x: 1, y: 0 }, { kick: true }), 90));

    expect(top).toBeLessThanOrEqual(medium.tuning.maxSpeed + 1e-9);
    expect(top).toBeGreaterThan(medium.tuning.maxSpeed * 0.95);
  });

  it('waits out its kick cooldown between kicks', () => {
    const { world, log } = racingWorld(medium, OPEN_ARENA);
    placeOnTile(playerOf(world), 2, 6);
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
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(medium.tuning.base.kickCooldownTicks);
  });

  it.each(MODIFIER_CASES.map((modifier) => [modifier.field, modifier] as const))(
    'moves differently when %s changes',
    (field, modifier) => {
      const base = medium.tuning.base;
      const changed = { ...base, [field]: modifier.changed(base) };

      expect(modifier.measure(medium, changed)).not.toBeCloseTo(modifier.measure(medium, base), 3);
    },
  );

  const directions = OPEN_SPACE_DIRECTIONS[id] ?? [];
  it('lists the directions it moves in through open space', () => {
    expect(directions.length, `add '${id}' to OPEN_SPACE_DIRECTIONS`).toBeGreaterThan(0);
  });

  it.each(directions.map((dir) => [dir.x.toFixed(2), dir.y.toFixed(2), dir] as const))(
    'makes progress through open space toward (%s, %s)',
    (_x, _y, dir) => {
      const { world } = racingWorld(medium, OPEN_ARENA);
      const player = playerOf(world);
      placeOnTile(player, 14, 6);
      const from = centreOf(player);
      for (let i = 0; i < 40; i++) stepWorld(world, hold(dir), TICK_DT);
      const to = centreOf(player);

      expect((to.x - from.x) * dir.x + (to.y - from.y) * dir.y).toBeGreaterThan(TILE);
    },
  );

  it.each(GEOMETRIES.map((geometry) => [geometry.name, geometry] as const))(
    'gets every rival through %s without stalling',
    (_name, geometry) => {
      const racers = raceThrough(medium, geometry.ascii);

      expect(racers.filter((racer) => !racer.finished).map((racer) => racer.id)).toEqual([]);
      expect(racers.filter((racer) => racer.longestStall >= STALL_LIMIT_TICKS)).toEqual([]);
    },
  );
});
