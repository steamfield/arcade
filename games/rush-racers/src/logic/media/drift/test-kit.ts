/**
 * Shared setup for drift's tests: a bare drifter stepped through `applyDriftIntent` (with its
 * position moved by hand, since only the world moves bodies), and racing worlds on small inline
 * drift courses with the rivals walled off in their own lane above the player's. Test-only;
 * nothing in the game imports it.
 */
import { EventLog, TICK_DT } from '@arcade/core';
import { PLAYER_PROFILE } from '../../ai/profiles.ts';
import type { CourseTuning } from '../../courses/types.ts';
import type { GameEvent } from '../../events.ts';
import { length } from '../../num.ts';
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
import type { DriftEnv } from './data.ts';
import { applyDriftIntent, createDriftMotion } from './physics.ts';
import { DRIFT_TUNING } from './tuning.ts';

/** Open space with no solar wind and no dust. */
export const VACUUM: DriftEnv = { kind: 'drift', wind: null, inDust: false };

/** Ticks in a number of seconds. */
export const ticksIn = (seconds: number) => Math.round(seconds / TICK_DT);

/** A drifter in slot 'player' at rest in open space, outside any world. */
export function bareDrifter(character: CharacterId = 'rudy'): Racer {
  const body = { x: 400, y: 400, vx: 0, vy: 0, w: RACER_SIZE.width, h: RACER_SIZE.height };
  return {
    id: 'player',
    character,
    motion: createDriftMotion(body),
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

/** One tick of a bare drift: the velocity after the tick and its length. */
export interface DriftSample {
  vx: number;
  vy: number;
  speed: number;
}

/**
 * Applies drift to a bare racer for `ticks` ticks with `input` (one intent, or one per tick counted
 * from 0), moving its body by its velocity after each; returns every tick's sample and the events
 * emitted (stamped with the tick, from 0).
 */
export function drift(
  racer: Racer,
  ticks: number,
  input: Intent | ((tick: number) => Intent),
  options: { env?: DriftEnv; mods?: MoveModifiers; tuning?: MediumTuning; log?: EventLog<GameEvent> } = {},
): { samples: DriftSample[]; log: EventLog<GameEvent> } {
  const log = options.log ?? new EventLog<GameEvent>(10_000);
  const tuning = options.tuning ?? DRIFT_TUNING;
  const samples = Array.from({ length: ticks }, (_, tick) => {
    log.tick = tick;
    const intent = typeof input === 'function' ? input(tick) : input;
    applyDriftIntent(racer, intent, options.env ?? VACUUM, tuning, options.mods ?? tuning.base, log, TICK_DT);
    racer.body.x += racer.body.vx * TICK_DT;
    racer.body.y += racer.body.vy * TICK_DT;
    return { vx: racer.body.vx, vy: racer.body.vy, speed: length(racer.body.vx, racer.body.vy) };
  });
  return { samples, log };
}

/** Rows above the player's area in every `driftWorld`. */
export const RIVAL_LANE_ROWS = 3;

/**
 * A racing drift world on `playerRows` (the player's area, with start 1 and the finish column)
 * under a three-row lane where the rivals start, sealed off by rock, so they never touch the player.
 * Player-area row r is level row r + `RIVAL_LANE_ROWS`.
 */
export function driftWorld(
  playerRows: readonly string[],
  options: { character?: CharacterId; difficulty?: Difficulty; tuning?: CourseTuning; seed?: number } = {},
) {
  const width = playerRows[0]?.length ?? 0;
  const rivalLane = [`${'.'.repeat(width - 1)}F`, `.234${'.'.repeat(width - 5)}F`, '#'.repeat(width)];
  const overrides = options.tuning ? { tuning: options.tuning } : {};
  const course = courseFromLevel([...rivalLane, ...playerRows].join('\n'), 'drift', overrides);
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

/** World ticks on which racer `id` emitted an event of `type`. */
export function ticksOfRacer(log: EventLog<GameEvent>, type: GameEvent['type'], id: RacerId = 'player'): number[] {
  return log
    .all()
    .filter((event) => event.type === type && 'id' in event && event.id === id)
    .map((event) => event.tick);
}
