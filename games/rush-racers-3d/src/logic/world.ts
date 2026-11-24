/**
 * The race: building the world, the countdown, stepping every racer in slot order, the finish and
 * the race limit, and the small summary scenarios assert on.
 *
 * `race.countdown` fires on steps 0, 60 and 120. Step `RACE.countdownTicks` starts the race and
 * runs its first racing tick. On each racing tick, `raceTicks` counts up, then each racer in
 * `racers` order takes `stepRacer` with its input, and `racer.finished` fires for one that just crossed. The race ends (`race.ended`, phase `finished`)
 * when the player finishes (phase 1) or at `RACE.limitTicks`. A finished world ignores input.
 */
import { type EventSink, TICK_HZ } from '@arcade/core';
import { assertCourse, groundY } from './course.ts';
import type { GameEvent } from './events.ts';
import { NO_INPUT, stepRacer } from './racer.ts';
import type { SaveData } from './save.ts';
import { DASH, RACE } from './tuning.ts';
import type { Racer, RacerId, TickInputs, World, WorldOptions } from './types.ts';

/**
 * A world on the start line in countdown. The player is in slot 0 at `d = 0`; with `rivals` (phase 2)
 * the rivals line up beside it `RACE.gridSpacing` apart.
 *
 * @throws {CourseError} When `options.course` is invalid.
 */
export function createWorld(events: EventSink<GameEvent>, options: WorldOptions): World {
  assertCourse(options.course);
  const { course } = options;
  const racer = (id: RacerId, d: number): Racer => ({
    id,
    character: options.character,
    s: course.startS,
    d,
    y: groundY(course, course.startS),
    vs: 0,
    vd: 0,
    vy: 0,
    grounded: true,
    coyoteTicks: 0,
    bufferTicks: 0,
    dashCharges: DASH.charges,
    dashRecharge: 0,
    dashTicks: 0,
    state: 'racing',
    outTicks: 0,
    invulnTicks: 0,
    safeS: course.startS,
    safeD: d,
    finishTicks: null,
  });
  const racers = [racer('player', 0)];
  if (options.rivals) throw new Error('rivals: not implemented until phase 2');
  return { seed: options.seed, course, phase: 'countdown', tick: 0, raceTicks: 0, racers, events };
}

/** Advances the world by one tick. */
export function stepWorld(world: World, inputs: TickInputs, dt: number): void {
  if (world.phase === 'finished') return;
  if (world.phase === 'countdown') {
    if (world.tick === 0) world.events.emit({ type: 'race.countdown', n: 3 });
    if (world.tick === TICK_HZ) world.events.emit({ type: 'race.countdown', n: 2 });
    if (world.tick === 2 * TICK_HZ) world.events.emit({ type: 'race.countdown', n: 1 });
    if (world.tick < RACE.countdownTicks) {
      world.tick++;
      return;
    }
    world.phase = 'racing';
    world.events.emit({ type: 'race.started' });
  }
  world.tick++;
  world.raceTicks++;
  const { course, events, raceTicks } = world;
  for (const racer of world.racers) {
    const wasFinished = racer.state === 'finished';
    stepRacer(racer, inputs[racer.id] ?? NO_INPUT, { course, events, raceTicks, speedMul: 1 }, dt);
    if (!wasFinished && racer.state === 'finished')
      events.emit({ type: 'racer.finished', id: racer.id, ticks: raceTicks });
  }
  if (playerOf(world).state === 'finished' || world.raceTicks >= RACE.limitTicks) {
    world.phase = 'finished';
    world.events.emit({ type: 'race.ended', ticks: world.raceTicks });
  }
}

/** The player's racer. */
export function playerOf(world: World): Racer {
  const player = world.racers[0];
  if (!player || player.id !== 'player') throw new Error('world has no player in slot 0');
  return player;
}

/**
 * The best-time update a finished race earns: `bests` with the course's best replaced when the
 * player finished faster than it (or had none). Returns the same object when nothing improved.
 */
export function withBest(world: World, bests: SaveData['bests']): SaveData['bests'] {
  const { finishTicks } = playerOf(world);
  const { id } = world.course;
  if (finishTicks === null || (Object.hasOwn(bests, id) && finishTicks >= (bests[id] ?? Infinity))) return bests;
  return { ...bests, [id]: finishTicks };
}

const round = (v: number) => Math.round(v * 10) / 10;

/** Small, stable view for the CLI summary and scenario assertions. `time` is race seconds to 0.1. */
export function summarize(world: World) {
  const p = playerOf(world);
  return {
    tick: world.tick,
    phase: world.phase,
    time: round(world.raceTicks / 60),
    player: { s: round(p.s), d: round(p.d), y: round(p.y), speed: round(p.vs), state: p.state },
    finishTicks: p.finishTicks,
  };
}
