/**
 * Shared setup for flight's tests: a bare flyer stepped through `applyFlightIntent` (with its
 * position moved by hand, since only the world moves bodies), and racing worlds on small inline
 * flight courses with the rivals walled off in their own lane above the player's. Test-only;
 * nothing in the game imports it.
 */
import { EventLog, TICK_DT } from '@arcade/core';
import { PLAYER_PROFILE } from '../../ai/profiles.ts';
import type { CourseTuning } from '../../courses/types.ts';
import type { GameEvent } from '../../events.ts';
import { noItems } from '../../racers.ts';
import { courseFromLevel, racerOf } from '../../test-world.ts';
import {
  type CharacterId,
  type Difficulty,
  type Intent,
  type MoveModifiers,
  RACER_SIZE,
  type Racer,
  type RacerId,
} from '../../types.ts';
import { createWorld } from '../../world.ts';
import type { MediumTuning } from '../types.ts';
import type { FlightEnv } from './data.ts';
import { applyFlightIntent, createFlightMotion } from './physics.ts';
import { FLIGHT_TUNING } from './tuning.ts';

/** Air with no wind and no fog. */
export const STILL_AIR: FlightEnv = { kind: 'flight', wind: null, inFog: false };

/** Ticks in a number of seconds. */
export const ticksIn = (seconds: number) => Math.round(seconds / TICK_DT);

/** A flyer in slot 'player' at rest in open air, outside any world. */
export function bareFlyer(character: CharacterId = 'rudy'): Racer {
  const body = { x: 400, y: 400, vx: 0, vy: 0, w: RACER_SIZE.width, h: RACER_SIZE.height };
  return {
    id: 'player',
    character,
    motion: createFlightMotion(body),
    body,
    facing: 1,
    kickCooldown: 0,
    kickCharges: 2,
    kickRecharge: 0,
    progress: Number.POSITIVE_INFINITY,
    place: 1,
    finished: null,
    ai: null,
    profile: PLAYER_PROFILE,
    ...noItems(3),
  };
}

/** One tick of a bare flight: velocity after the tick and the height the body reached. */
export interface FlightSample {
  vx: number;
  vy: number;
  /** Body top, px, after moving by this tick's velocity. */
  y: number;
}

/**
 * Applies flight to a bare racer for `ticks` ticks with `input` (one intent, or one per tick
 * counted from 0), moving its body by its velocity after each; returns every tick's sample and
 * the events emitted (stamped with the tick, from 0).
 */
export function fly(
  racer: Racer,
  ticks: number,
  input: Intent | ((tick: number) => Intent),
  options: { env?: FlightEnv; mods?: MoveModifiers; tuning?: MediumTuning; log?: EventLog<GameEvent> } = {},
): { samples: FlightSample[]; log: EventLog<GameEvent> } {
  const log = options.log ?? new EventLog<GameEvent>(10_000);
  const tuning = options.tuning ?? FLIGHT_TUNING;
  const samples = Array.from({ length: ticks }, (_, tick) => {
    log.tick = tick;
    const intent = typeof input === 'function' ? input(tick) : input;
    applyFlightIntent(racer, intent, options.env ?? STILL_AIR, tuning, options.mods ?? tuning.base, log, TICK_DT);
    racer.body.x += racer.body.vx * TICK_DT;
    racer.body.y += racer.body.vy * TICK_DT;
    return { vx: racer.body.vx, vy: racer.body.vy, y: racer.body.y };
  });
  return { samples, log };
}

/**
 * A racing flight world on `playerRows` (the player's area, with start 1 and the finish column)
 * under a three-row lane where the rivals start, sealed off by rock, so they never touch the player.
 * Player-area row r is level row r + `RIVAL_LANE_ROWS`.
 */
export function flightWorld(
  playerRows: readonly string[],
  options: { character?: CharacterId; difficulty?: Difficulty; tuning?: CourseTuning; seed?: number } = {},
) {
  const width = playerRows[0]?.length ?? 0;
  const rivalLane = [`${'.'.repeat(width - 1)}F`, `.234${'.'.repeat(width - 5)}F`, '#'.repeat(width)];
  const overrides = options.tuning ? { tuning: options.tuning } : {};
  const course = courseFromLevel([...rivalLane, ...playerRows].join('\n'), 'flight', overrides);
  const log = new EventLog<GameEvent>(100_000);
  const world = createWorld(course, log, {
    seed: options.seed ?? 1,
    character: options.character ?? 'rudy',
    endsWhen: 'everyone',
    ...(options.difficulty ? { difficulty: options.difficulty } : {}),
  });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'everyone' };
  return { world, log, player: racerOf(world, 'player') };
}

/** Rows above the player's area in every `flightWorld`. */
export const RIVAL_LANE_ROWS = 3;

/** World ticks on which racer `id` emitted an event of `type`. */
export function ticksOfRacer(log: EventLog<GameEvent>, type: GameEvent['type'], id: RacerId = 'player'): number[] {
  return log
    .all()
    .filter((event) => event.type === type && 'id' in event && event.id === id)
    .map((event) => event.tick);
}
