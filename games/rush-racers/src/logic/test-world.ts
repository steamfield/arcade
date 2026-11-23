/**
 * Shared setup for logic tests: a racing world from inline ASCII, finding and
 * placing racers, stepping with readable input, and reading events without their
 * stamps. Test-only; nothing in the game imports it.
 */
import { EventLog, TICK_DT } from '@arcade/core';
import { stackMaxFor } from './abilities.ts';
import { registerCourse } from './courses/index.ts';
import type { Course } from './courses/types.ts';
import type { GameEvent } from './events.ts';
import { CHARGES } from './powerups/charges.ts';
import { setItems } from './powerups/inventory.ts';
import {
  type HeldItem,
  type LevelDef,
  type PowerUpKind,
  type Racer,
  type RacerId,
  type RivalProfile,
  TILE,
  type TickInput,
  type Vec,
  type World,
} from './types.ts';
import { createWorld, stepWorld } from './world.ts';
import { registerWorld, WORLDS, worldById } from './worlds/index.ts';

let testCourses = 0;

/**
 * The id of a world that races in `medium`: Reef for swim, else a test world with Reef's names
 * (registered on first use), so a test course can race in a test medium such as glide.
 */
export function worldFor(medium: string): string {
  if (medium === WORLDS.reef.medium) return WORLDS.reef.id;
  const id = `test-${medium}`;
  if (!worldById(id)) registerWorld({ ...WORLDS.reef, id, name: id, medium });
  return id;
}

/**
 * A fresh unlisted course on `level` (a definition, or bare ASCII), registered so a world can hold
 * its id. Each call makes its own course, so two tests never share a level. `overrides` (such as
 * `tuning`) are applied before the course is registered, since a course must not change after its
 * first use.
 */
export function courseFromLevel(level: LevelDef | string, medium = 'swim', overrides: Partial<Course> = {}): Course {
  testCourses++;
  const world = worldFor(medium);
  const def = typeof level === 'string' ? { name: 'test', ascii: level } : level;
  const course: Course = {
    id: `test-${testCourses}`,
    name: def.name,
    level: def,
    world,
    theme: 'ocean',
    song: 'race',
    listed: false,
    parTicks: 60 * 60,
    ...overrides,
  };
  registerCourse(course);
  return course;
}

export const IDLE: TickInput = { move: { x: 0, y: 0 }, kick: false, use: false, cycle: 0 };

/** Input holding `move` (and optionally pressing kick, use or a cycle) for a tick. */
export function hold(
  move: Vec,
  presses: { kick?: boolean; use?: boolean; cycle?: -1 | 0 | 1; useSlot?: number } = {},
): TickInput {
  const input: TickInput = { move, kick: presses.kick ?? false, use: presses.use ?? false, cycle: presses.cycle ?? 0 };
  if (presses.useSlot !== undefined) input.useSlot = presses.useSlot;
  return input;
}

/**
 * A world on `ascii` already racing (countdown skipped, nothing stepped yet), with an empty event log.
 * `playerBot` lets an AI profile drive the player.
 */
export function raceOn(ascii: LevelDef | string, options: { seed?: number; playerBot?: RivalProfile } = {}) {
  const log = new EventLog<GameEvent>(100_000);
  const world = createWorld(courseFromLevel(ascii), log, { seed: options.seed ?? 1, ...options });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'player' };
  return { world, log };
}

export function racerOf(world: World, id: RacerId): Racer {
  const found = world.racers.find((racer) => racer.id === id);
  if (!found) throw new Error(`No racer '${id}' in the world (racers: ${world.racers.map((r) => r.id).join(', ')})`);
  return found;
}

/**
 * Fills `racer`'s slots from the left: a kind (with its `CHARGES`), a `HeldItem`, or null for an
 * empty slot. Slots past the list are emptied. Selects `selected`.
 *
 * @throws {Error} As `setItems` does: a kind given twice, or `selected` on an empty slot.
 */
export function giveItems(racer: Racer, items: readonly (PowerUpKind | HeldItem | null)[], selected = 0): void {
  const slots = Array.from({ length: stackMaxFor(racer) }, (_, slot): HeldItem | null => {
    const item = items[slot] ?? null;
    if (item === null) return null;
    return typeof item === 'string' ? { kind: item, charges: CHARGES[item] } : item;
  });
  setItems(racer, slots, selected);
}

/** Centre of tile (tx, ty) in world px. */
export function tileCentre(tx: number, ty: number): Vec {
  return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
}

/** Puts a racer's centre at `at` (world px), at rest. */
export function placeAt(racer: Racer, at: Vec): void {
  racer.body.x = at.x - racer.body.w / 2;
  racer.body.y = at.y - racer.body.h / 2;
  racer.body.vx = 0;
  racer.body.vy = 0;
}

/** Puts a racer's centre on the centre of tile (tx, ty), at rest. */
export function placeOnTile(racer: Racer, tx: number, ty: number): void {
  placeAt(racer, tileCentre(tx, ty));
}

/** Steps `ticks` times with the same input, stamping events with the tick they happen on. */
export function step(world: World, log: EventLog<GameEvent>, ticks = 1, input: TickInput = IDLE): void {
  for (let i = 0; i < ticks; i++) {
    log.tick = world.tick + 1;
    stepWorld(world, input, TICK_DT);
  }
}

/** Every event so far without its tick and sequence stamps, optionally only the given types. */
export function eventsIn(log: EventLog<GameEvent>, ...types: GameEvent['type'][]): GameEvent[] {
  return log
    .all()
    .filter((event) => types.length === 0 || types.includes(event.type))
    .map(({ tick: _tick, seq: _seq, ...event }) => event as GameEvent);
}

/** World ticks on which events of `type` happened. */
export function ticksOf(log: EventLog<GameEvent>, type: GameEvent['type']): number[] {
  return log
    .all()
    .filter((event) => event.type === type)
    .map((event) => event.tick);
}
