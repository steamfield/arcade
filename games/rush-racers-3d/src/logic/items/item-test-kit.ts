import { EventLog, TICK_DT } from '@arcade/core';
import type { GameEvent } from '../events.ts';
import { NO_INPUT } from '../racer.ts';
import { RACE } from '../tuning.ts';
import type { Course, Feature, TickInput } from '../types.ts';
import { createWorld, playerOf, stepWorld } from '../world.ts';

export function start(features: Feature[] = [], withRival = false, seed = 4, finishS = 200) {
  const course: Course = {
    id: 'item-straight',
    name: 'Item Straight',
    path: [{ kind: 'straight', length: 200 }],
    halfWidth: 6,
    hills: [],
    startS: 0,
    finishS,
    parTicks: 900,
    features,
  };
  const events = new EventLog<GameEvent>();
  const world = createWorld(events, { course, seed, character: 'grit', rivals: withRival });
  function advance(ticks = 1, input: Partial<TickInput> = {}) {
    for (let i = 0; i < ticks; i++) {
      events.tick = world.tick;
      stepWorld(world, { player: { ...NO_INPUT, ...input } }, TICK_DT);
    }
  }
  advance(RACE.countdownTicks);
  return { world, events, player: playerOf(world), advance };
}

export function startPair(features: Feature[] = []) {
  const race = start(features, true);
  race.world.racers.splice(2);
  const rival = race.world.racers[1];
  if (!rival) throw new Error('expected a rival');
  return { ...race, rival };
}
