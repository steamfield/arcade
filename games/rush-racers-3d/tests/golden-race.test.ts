/**
 * A behavior pin for refactors: four-racer races on Thornwood with items, the player driven by the
 * rivals' own AI, compared with a trace recorded from the code before the refactor. The world hash
 * changes whenever state is reshaped; this trace only changes when behavior does.
 *
 * Re-record deliberately, and say so in the commit: `GOLDEN_RECORD=1 pnpm arcade test rush-racers-3d tests/golden-race.test.ts`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { EventLog, hashState, TICK_DT } from '@arcade/core';
import { expect, it } from 'vitest';
import { rivalInput } from '../src/logic/ai.ts';
import { THORNWOOD_TRAIL } from '../src/logic/courses/thornwood-trail.ts';
import type { GameEvent } from '../src/logic/events.ts';
import { createWorld, playerOf, stepWorld } from '../src/logic/world.ts';

const FIXTURE = new URL('./golden/race.json', import.meta.url);
/** Seeds whose races include sap traps, mud splats and item hits. */
const SEEDS = [3, 11, 12];
const MAX_TICKS = 20_000;

function runRace(seed: number) {
  const events = new EventLog<GameEvent>(1_000_000);
  const world = createWorld(events, { course: THORNWOOD_TRAIL, seed, character: 'skip', rivals: true });
  while (world.phase !== 'finished' && world.tick < MAX_TICKS) {
    events.tick = world.tick;
    stepWorld(world, { player: rivalInput(world, playerOf(world)) }, TICK_DT);
  }
  const all = events.all();
  const counts: Record<string, number> = {};
  for (const event of all) counts[event.type] = (counts[event.type] ?? 0) + 1;
  return {
    ticks: world.tick,
    events: { count: all.length, byType: counts, hash: hashState(all) },
    racers: world.racers.map((racer) => ({
      id: racer.id,
      s: racer.s,
      d: racer.d,
      y: racer.y,
      vs: racer.vs,
      state: racer.state,
      finishTicks: racer.finishTicks,
      ...racer.items,
    })),
  };
}

it('races the golden Thornwood races exactly as recorded', () => {
  const traces = Object.fromEntries(SEEDS.map((seed) => [seed, runRace(seed)]));
  if (process.env.GOLDEN_RECORD) writeFileSync(FIXTURE, `${JSON.stringify(traces, null, 2)}\n`);
  const total = (type: string) => SEEDS.reduce((sum, seed) => sum + (traces[seed]?.events.byType[type] ?? 0), 0);
  for (const type of ['crate.opened', 'item.fired', 'racer.trapped', 'pie.splatted', 'racer.hit']) {
    expect(total(type), type).toBeGreaterThan(0);
  }
  expect(traces).toEqual(JSON.parse(readFileSync(FIXTURE, 'utf8')));
});
