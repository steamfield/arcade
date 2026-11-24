/**
 * Shared setup for the flight rival tests: racing worlds on a small inline sky where the rivals a test
 * places (tess is start 2, squib start 3) fly the area under test, while the player and every other
 * racer sit on a sealed bench lane below it, so only those rivals share the sky. Test-only; nothing in the game imports it.
 */
import { EventLog } from '@arcade/core';
import type { CourseTuning } from '../../courses/types.ts';
import type { GameEvent } from '../../events.ts';
import { courseFromLevel, racerOf, step } from '../../test-world.ts';
import { type LightningZone, type Racer, type RacerId, type RivalProfile, TILE, type World } from '../../types.ts';
import { createWorld } from '../../world.ts';

/** How a test rival flies: steady (no wobble), quick to react and never dashing unless a test says otherwise. */
export const STEADY_FLYER: Partial<RivalProfile> = { wobble: 0, reactionTicks: 2, kickSkill: 0 };

/**
 * `area` (rows of equal width ending in a finish column) above a bench: a rock row, a one-row lane
 * running to the finish with every start (1-4) the area doesn't place, two tiles apart, and a rock floor.
 */
export function withBench(area: readonly string[]): string {
  const width = area[0]?.length ?? 0;
  const benched = ['1', '2', '3', '4'].filter((start) => !area.some((row) => row.includes(start)));
  const lane = `#${benched.map((start) => `${start}.`).join('')}`.padEnd(width - 1, '.');
  return [...area, '#'.repeat(width), `${lane}F`, '#'.repeat(width)].join('\n');
}

/**
 * A racing world (seed 1, everyone racing to the line) on `withBench(area)` with any storm zones in
 * `options.lightning`, each rival in `profiles` flying with its own profile overridden by those fields.
 */
export function benchRace(
  area: readonly string[],
  profiles: Partial<Record<'tess' | 'squib', Partial<RivalProfile>>>,
  options: { tuning?: CourseTuning; lightning?: LightningZone[] } = {},
): { world: World; log: EventLog<GameEvent> } {
  const overrides = options.tuning ? { tuning: options.tuning } : {};
  const level = {
    name: 'test',
    ascii: withBench(area),
    ...(options.lightning ? { lightning: options.lightning } : {}),
  };
  const course = courseFromLevel(level, 'flight', overrides);
  const log = new EventLog<GameEvent>(100_000);
  const world = createWorld(course, log, { seed: 1, endsWhen: 'everyone' });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'everyone' };
  for (const [id, fields] of Object.entries(profiles)) {
    const rival = racerOf(world, id as RacerId);
    rival.profile = { ...rival.profile, ...fields };
  }
  return { world, log };
}

/**
 * Steps `world` one tick at a time (events stamped with the tick) until every racer in `ids` has
 * finished or `limit` ticks have passed, calling `onTick` after each.
 */
export function raceUntilFinished(
  world: World,
  log: EventLog<GameEvent>,
  ids: readonly RacerId[],
  limit: number,
  onTick: (tick: number) => void = () => {},
): void {
  for (let tick = 1; tick <= limit && ids.some((id) => racerOf(world, id).finished === null); tick++) {
    step(world, log, 1);
    onTick(tick);
  }
}

/** The racer's centre in world px. */
export const centre = (racer: Racer) => ({ x: racer.body.x + racer.body.w / 2, y: racer.body.y + racer.body.h / 2 });

/** The column (tile x) a px x lies in. */
export const columnOf = (x: number) => Math.floor(x / TILE);
