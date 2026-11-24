/**
 * Shared setup for the media tests: a bare racer stepped through a medium's `applyXIntent` with
 * its position moved by hand (only the world moves bodies), and racing worlds on small inline
 * courses with the rivals walled off in their own lane above the player's. Each medium's
 * `test-kit.ts` adds what is specific to it. Test-only; nothing in the game imports it.
 */
import { EventLog, type EventSink, TICK_DT } from '@arcade/core';
import { PLAYER_PROFILE } from '../ai/profiles.ts';
import type { CourseTuning } from '../courses/types.ts';
import type { GameEvent } from '../events.ts';
import { noItems } from '../racers.ts';
import { courseFromLevel, racerOf } from '../test-world.ts';
import {
  type CharacterId,
  type Difficulty,
  type Intent,
  type MoveModifiers,
  RACER_SIZE,
  type Racer,
  type RacerId,
  type WellDef,
} from '../types.ts';
import { createWorld } from '../world.ts';
import type { MediumEnv, MediumTuning, RacerMotion } from './types.ts';

/** Rows above the player's area in every `laneWorld`. */
export const RIVAL_LANE_ROWS = 3;

/** Ticks in a number of seconds. */
export const ticksIn = (seconds: number) => Math.round(seconds / TICK_DT);

/** Who a bare racer is and where it starts (px from the top-left of the empty space it floats in). */
interface BareRacerOptions {
  character?: CharacterId;
  x?: number;
  y?: number;
}

/**
 * A racer in slot 'player' at rest, outside any world. `motionFor` builds the medium's motion
 * state for the racer's body, e.g. `createFlightMotion`.
 */
export function bareRacer(motionFor: (body: Racer['body']) => RacerMotion, options: BareRacerOptions = {}): Racer {
  const body = {
    x: options.x ?? 400,
    y: options.y ?? 400,
    vx: 0,
    vy: 0,
    w: RACER_SIZE.width,
    h: RACER_SIZE.height,
  };
  return {
    id: 'player',
    character: options.character ?? 'rudy',
    motion: motionFor(body),
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

/** A medium's `applyXIntent`: one tick of movement for one racer. */
type ApplyIntent = (
  racer: Racer,
  intent: Intent,
  env: MediumEnv,
  tuning: MediumTuning,
  mods: MoveModifiers,
  events: EventSink<GameEvent>,
  dt: number,
) => void;

/** What `stepBare` runs the racer under. */
interface BareStepSetup {
  env: MediumEnv;
  tuning: MediumTuning;
  /** Defaults to the tuning's base modifiers. */
  mods?: MoveModifiers;
  log?: EventLog<GameEvent>;
  /** Moves the body by its velocity after each tick, as the world would. Off by default. */
  moveBody?: boolean;
}

/**
 * Applies a medium to a bare racer for `ticks` ticks with `input` (one intent, or one per tick
 * counted from 0); returns `sample(racer)` after each tick and the events emitted (stamped with
 * the tick, from 0).
 */
export function stepBare<Sample>(
  apply: ApplyIntent,
  racer: Racer,
  ticks: number,
  input: Intent | ((tick: number) => Intent),
  setup: BareStepSetup,
  sample: (racer: Racer) => Sample,
): { samples: Sample[]; log: EventLog<GameEvent> } {
  const log = setup.log ?? new EventLog<GameEvent>(10_000);
  const mods = setup.mods ?? setup.tuning.base;
  const samples = Array.from({ length: ticks }, (_, tick) => {
    log.tick = tick;
    const intent = typeof input === 'function' ? input(tick) : input;
    apply(racer, intent, setup.env, setup.tuning, mods, log, TICK_DT);
    if (setup.moveBody) {
      racer.body.x += racer.body.vx * TICK_DT;
      racer.body.y += racer.body.vy * TICK_DT;
    }
    return sample(racer);
  });
  return { samples, log };
}

/** What `laneWorld` races. */
export interface LaneWorldOptions {
  character?: CharacterId;
  difficulty?: Difficulty;
  tuning?: CourseTuning;
  seed?: number;
  /** Gravity wells, their rows counted in the player's area like `playerRows`. */
  wells?: readonly WellDef[];
}

/**
 * A racing world of `medium` on `playerRows` (the player's area, with start 1 and the finish
 * column) under a three-row lane where the rivals start, sealed off by rock, so they never touch
 * the player. Player-area row r is level row r + `RIVAL_LANE_ROWS`.
 */
export function laneWorld(medium: string, playerRows: readonly string[], options: LaneWorldOptions = {}) {
  const width = playerRows[0]?.length ?? 0;
  const rivalLane = [`${'.'.repeat(width - 1)}F`, `.234${'.'.repeat(width - 5)}F`, '#'.repeat(width)];
  const overrides = options.tuning ? { tuning: options.tuning } : {};
  const wells = (options.wells ?? []).map((well) => ({ ...well, row: well.row + RIVAL_LANE_ROWS }));
  const level = { name: 'test', ascii: [...rivalLane, ...playerRows].join('\n'), wells };
  const log = new EventLog<GameEvent>(100_000);
  const world = createWorld(courseFromLevel(level, medium, overrides), log, {
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
