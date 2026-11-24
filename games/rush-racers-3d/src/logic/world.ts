/**
 * The race: building the world, the countdown, stepping every racer in slot order, the finish and
 * the race limit, and the small summary scenarios assert on.
 *
 * `race.countdown` fires on steps 0, 60 and 120. Step `RACE.countdownTicks` starts the race and
 * runs its first racing tick. Each racing tick runs movement in slot order, resolves bumps, awards
 * places to new finishers and checks the race deadline. A finished world ignores input.
 */
import { type EventSink, TICK_HZ } from '@arcade/core';
import { rivalInput } from './ai.ts';
import { bumpRacers } from './bump.ts';
import { drawRivals } from './characters.ts';
import { assertCourse, groundY } from './course.ts';
import type { GameEvent } from './events.ts';
import { gridD } from './grid.ts';
import { NO_INPUT, stepRacer } from './racer.ts';
import type { SaveData } from './save.ts';
import { placeOf } from './standings.ts';
import { DASH, ITEMS, RACE, RIVAL } from './tuning.ts';
import type { CharacterId, Racer, RacerId, TickInputs, World, WorldOptions } from './types.ts';

/**
 * A world on the start line in countdown. The solo player starts on the centreline. With rivals,
 * four lanes are spaced up to `RACE.gridSpacing` apart within the track edges.
 *
 * @throws {CourseError} When `options.course` is invalid.
 */
export function createWorld(events: EventSink<GameEvent>, options: WorldOptions): World {
  assertCourse(options.course);
  const { course } = options;
  const racer = (id: RacerId, character: CharacterId, d: number): Racer => ({
    id,
    character,
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
    slots: Array.from({ length: ITEMS.slots }, () => null),
    selected: 0,
    itemCooldown: 0,
    stunTicks: 0,
    trappedTicks: 0,
    burrTicks: 0,
    bootsTicks: 0,
  });
  const draw = options.rivals ? drawRivals(options.seed, options.character) : null;
  const racers = [racer('player', options.character, draw ? gridD(course, 'player') : 0)];
  if (draw) {
    const [first, second, third] = draw.rivals;
    racers.push(
      racer('r1', first, gridD(course, 'r1')),
      racer('r2', second, gridD(course, 'r2')),
      racer('r3', third, gridD(course, 'r3')),
    );
  }
  return {
    seed: options.seed,
    course,
    phase: 'countdown',
    tick: 0,
    raceTicks: 0,
    racers,
    rngState: draw?.rngState ?? options.seed >>> 0,
    endTick: null,
    crates: course.features.filter((f) => f.kind === 'crate').map(() => ({ shutTicks: 0 })),
    shots: [],
    splats: [],
    events,
  };
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
  const player = playerOf(world);
  const playerS = player.s;
  const hasRivals = world.racers.length > 1;
  const startD = hasRivals ? world.racers.map((racer) => (racer.state === 'racing' ? racer.d : null)) : undefined;
  for (const racer of world.racers) {
    const isPlayer = racer.id === 'player';
    const input = isPlayer ? (inputs.player ?? NO_INPUT) : rivalInput(world, racer);
    const gap = (playerS - racer.s) / RIVAL.catchUpRange;
    const speedMul = isPlayer ? 1 : 1 + Math.max(-1, Math.min(1, gap)) * RIVAL.catchUp;
    stepRacer(racer, input, { course, events, raceTicks, speedMul }, dt);
  }
  if (startD) bumpRacers(world, startD);
  for (const racer of world.racers) {
    if (racer.finishTicks === raceTicks) {
      events.emit({ type: 'racer.finished', id: racer.id, ticks: raceTicks, place: placeOf(world, racer.id) });
    }
  }

  if (player.finishTicks !== null) endRace(world, 'player-finished');
  else if (raceTicks >= RACE.limitTicks) endRace(world, 'limit');
  else if (world.endTick !== null && world.tick >= world.endTick) endRace(world, 'rivals-finished');
  else if (
    world.endTick === null &&
    hasRivals &&
    world.racers.every((racer) => racer.id === 'player' || racer.finishTicks !== null)
  ) {
    world.endTick = world.tick + RACE.rivalsDoneGraceTicks;
  }
}

function endRace(world: World, reason: Extract<GameEvent, { type: 'race.ended' }>['reason']): void {
  world.phase = 'finished';
  world.events.emit({ type: 'race.ended', ticks: world.raceTicks, reason });
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
