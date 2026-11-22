/**
 * The race as one deterministic step function. This module only sets the order
 * things happen in each tick; every rule lives in the module it calls.
 *
 * Tick order: clock; intents for every racer from the start-of-tick state (in
 * RACER_IDS order); each racer's swimming and movement (RACER_IDS order); one
 * pass of racer separation; progress, finishes, places, race end.
 */
import { createRng, type EventSink } from '@arcade/core';
import { PLAYER_PROFILE, RIVAL_PROFILES } from './ai/profiles.ts';
import { createAiMemory, rivalIntent } from './ai/rival.ts';
import type { GameEvent } from './events.ts';
import { LevelError } from './level/parse.ts';
import { sampleEnvironment } from './level/query.ts';
import { modifiersFor } from './modifiers.ts';
import { buildFlowFields, unreachableStarts } from './race/flowfield.ts';
import { advanceClock, checkRaceEnd, recordFinishes, updatePlaces, updateProgress } from './race/standings.ts';
import { moveBody, separateRacers } from './swim/collide.ts';
import { applyIntent, SWIM } from './swim/physics.ts';
import {
  type Intent,
  type Level,
  RACER_IDS,
  type Racer,
  type RacerId,
  type RivalProfile,
  RNG_SALTS,
  type RngStream,
  TILE,
  type TickInput,
  type World,
} from './types.ts';

export interface WorldOptions {
  /** Seeds every random stream. Same seed and inputs, same race. */
  seed: number;
  /** When set, this profile's AI drives the player's racer and `stepWorld` ignores its input. Used by bot tests. */
  playerBot?: RivalProfile;
}

const IDLE: Intent = { move: { x: 0, y: 0 }, kick: false, burst: false };

/**
 * Sets up a race on `level` at the countdown's first tick.
 *
 * @param events Usually the engine's EventLog, so one stream holds race, menu and save events.
 * @throws {LevelError} When a start tile cannot reach the finish without breaking coral.
 */
export function createWorld(level: Level, events: EventSink<GameEvent>, options: WorldOptions): World {
  const broken = new Set<number>();
  const fields = buildFlowFields(level, broken);
  const sealed = unreachableStarts(level, fields);
  const firstSealed = sealed[0];
  if (firstSealed !== undefined) {
    const start = level.starts[firstSealed];
    throw new LevelError(
      `Start ${firstSealed + 1} cannot reach the finish without breaking coral`,
      start?.y ?? null,
      start?.x ?? null,
    );
  }
  const world: World = {
    level,
    fields,
    broken,
    racers: RACER_IDS.map((id, index) => createRacer(level, id, index, options.playerBot)),
    race: { phase: 'countdown', raceTick: 0, rivalsDoneAt: null, result: null },
    tick: 0,
    rngs: createRngs(options.seed),
    events,
    contacts: new Set(),
  };
  // Catch-up reads progress on the first racing tick, before stepWorld updates it.
  updateProgress(world);
  return world;
}

function createRacer(level: Level, id: RacerId, index: number, playerBot: RivalProfile | undefined): Racer {
  const start = level.starts[index];
  if (!start) throw new LevelError(`Level has no start ${index + 1}`);
  const isHuman = id === 'player' && !playerBot;
  const profile = id === 'player' ? (playerBot ?? PLAYER_PROFILE) : RIVAL_PROFILES[id];
  return {
    id,
    body: {
      x: start.x * TILE + (TILE - SWIM.width) / 2,
      y: start.y * TILE + (TILE - SWIM.height) / 2,
      vx: 0,
      vy: 0,
      w: SWIM.width,
      h: SWIM.height,
    },
    facing: 1,
    kickCooldown: 0,
    progress: Number.POSITIVE_INFINITY,
    place: index + 1,
    finished: null,
    ai: isHuman ? null : createAiMemory(),
    profile,
  };
}

function createRngs(seed: number): World['rngs'] {
  const streams = Object.keys(RNG_SALTS) as RngStream[];
  return Object.fromEntries(
    streams.map((stream) => [stream, createRng((seed ^ RNG_SALTS[stream]) >>> 0)]),
  ) as World['rngs'];
}

/** Advances the race by one fixed tick. `input` drives the player's racer unless a bot does. */
export function stepWorld(world: World, input: TickInput, dt: number): void {
  world.tick++;
  if (world.race.phase === 'finished') return;
  if (advanceClock(world)) return;

  const intents = world.racers.map((racer) => intentFor(world, racer, input));
  const player = playerOf(world);
  world.racers.forEach((racer, index) => {
    const env = sampleEnvironment(world.level, racer.body);
    applyIntent(racer, intents[index] ?? IDLE, env, modifiersFor(racer, player), world.events, dt);
    moveBody(racer.body, world.level, world.broken, dt);
  });
  separateRacers(world.racers, world.contacts, world.events);

  updateProgress(world);
  recordFinishes(world);
  updatePlaces(world);
  checkRaceEnd(world);
}

function intentFor(world: World, racer: Racer, input: TickInput): Intent {
  if (racer.finished) return IDLE;
  if (!racer.ai) return input;
  return rivalIntent(world, racer, world.rngs[`ai.${racer.id}`]);
}

/** The player's racer. Always first in `world.racers`. */
export function playerOf(world: World): Racer {
  const player = world.racers[0];
  if (player?.id !== 'player') throw new Error('World has no player racer at index 0');
  return player;
}

/** Small, stable view for the CLI summary and scenario assertions. */
export function summarize(world: World) {
  const player = playerOf(world);
  const centre = centreTile(player);
  return {
    tick: world.tick,
    phase: world.race.phase,
    raceTick: world.race.raceTick,
    place: `${player.place}/${world.racers.length}`,
    progress: Number.isFinite(player.progress) ? Math.round(player.progress) : null,
    finished: player.finished !== null,
    player: { tile: centre, kickReady: player.kickCooldown === 0 },
  };
}

function centreTile(racer: Racer): [number, number] {
  const { body } = racer;
  return [Math.floor((body.x + body.w / 2) / TILE), Math.floor((body.y + body.h / 2) / TILE)];
}

const CELL_CHAR = {
  water: '.',
  rock: '#',
  coral: 'C',
  kelp: '~',
  'current-right': '>',
  'current-left': '<',
  'current-up': '^',
  'current-down': 'v',
} as const;

const RACER_CHAR: Record<RacerId, string> = { player: '@', tess: 'T', squib: 'S', bo: 'B' };

/** The course as text with racers drawn at their centre tiles. Readable in test failures and `arcade see --ascii`. */
export function toAscii(world: World): string {
  const racerAt = new Map(world.racers.map((racer) => [centreTile(racer).join(','), RACER_CHAR[racer.id]]));
  return world.level.cells
    .map((row, y) =>
      row
        .map((cell, x) => {
          const racer = racerAt.get(`${x},${y}`);
          if (racer) return racer;
          if (x === world.level.finishX && cell === 'water') return 'F';
          if (cell === 'coral' && world.broken.has(y * world.level.width + x)) return '.';
          return CELL_CHAR[cell];
        })
        .join(''),
    )
    .join('\n');
}
