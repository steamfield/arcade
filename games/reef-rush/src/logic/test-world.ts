/**
 * Shared setup for logic tests: a racing world from inline ASCII, finding and
 * placing racers, stepping with readable input, and reading events without their
 * stamps. Test-only; nothing in the game imports it.
 */
import { EventLog, TICK_DT } from '@arcade/core';
import type { GameEvent } from './events.ts';
import { parseLevel } from './level/parse.ts';
import { type Racer, type RacerId, type RivalProfile, TILE, type TickInput, type Vec, type World } from './types.ts';
import { createWorld, stepWorld } from './world.ts';

export const IDLE: TickInput = { move: { x: 0, y: 0 }, kick: false, burst: false };

/** Input holding `move` (and optionally kick or burst) for a tick. */
export function hold(move: Vec, presses: { kick?: boolean; burst?: boolean } = {}): TickInput {
  return { move, kick: presses.kick ?? false, burst: presses.burst ?? false };
}

/**
 * A world on `ascii` already racing (countdown skipped, nothing stepped yet), with an empty event log.
 * `playerBot` lets an AI profile drive the player.
 */
export function raceOn(ascii: string, options: { seed?: number; playerBot?: RivalProfile } = {}) {
  const log = new EventLog<GameEvent>(100_000);
  const world = createWorld(parseLevel({ name: 'test', ascii }), log, { seed: options.seed ?? 1, ...options });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'player' };
  return { world, log };
}

export function racerOf(world: World, id: RacerId): Racer {
  const found = world.racers.find((racer) => racer.id === id);
  if (!found) throw new Error(`No racer '${id}' in the world (racers: ${world.racers.map((r) => r.id).join(', ')})`);
  return found;
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
