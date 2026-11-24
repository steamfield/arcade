/**
 * What online play rests on: two players' machines each build their own world and step it from the
 * same inputs, and must stay in the same state for the whole race, including when one player
 * leaves and the AI takes their racer over.
 */
import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { TOP_ROUTE } from '../../scenarios/kit.ts';
import { DEFAULT_COURSE } from './courses/index.ts';
import type { GameEvent } from './events.ts';
import { hashWorld } from './hash.ts';
import { COUNTDOWN_TICKS, RACE_LIMIT_TICKS } from './race/standings.ts';
import { eventsIn, hold, IDLE } from './test-world.ts';
import type { RacerId, TickInput } from './types.ts';
import { createWorld, stepRace } from './world.ts';

type Inputs = Partial<Record<RacerId, TickInput>>;

/**
 * Each test steps two whole races: about 2 s on an idle laptop, and it has overrun Vitest's 5 s
 * default under a loaded run. 6 s a race, as the difficulty bars budget (`racesTimeoutMs`).
 */
const TWO_RACES_TIMEOUT_MS = 12_000;

/** Ticks between the hash checks peers will exchange. */
const HASH_EVERY = 60;
/** World tick after which the second player's input stops arriving. */
const TESS_LEAVES_AT = 1500;
/** How far behind the first player's route the second player swims the same route. */
const TESS_DELAY_TICKS = 30;

/** `TOP_ROUTE` as one input per tick, the way the browser's input reads the held keys. */
const ROUTE: readonly TickInput[] = TOP_ROUTE.flatMap((step) => {
  const x = (step.actions.includes('right') ? 1 : 0) - (step.actions.includes('left') ? 1 : 0);
  const y = (step.actions.includes('down') ? 1 : 0) - (step.actions.includes('up') ? 1 : 0);
  const scale = x !== 0 && y !== 0 ? Math.SQRT1_2 : 1;
  return Array.from({ length: step.ticks }, () => hold({ x: x * scale, y: y * scale }));
});

/** Both players' inputs for world tick `tick`: the route, the second player delayed, then gone. */
function scriptedInputs(tick: number): Inputs {
  const inputs: Inputs = { player: ROUTE[tick - 1] ?? hold({ x: 1, y: 0 }) };
  if (tick <= TESS_LEAVES_AT) inputs.tess = ROUTE[tick - 1 - TESS_DELAY_TICKS] ?? IDLE;
  return inputs;
}

/** One player's machine: its own world and log, stepped to the end of the race from `inputsAt`. */
function runPeer(inputsAt: (tick: number) => Inputs) {
  const log = new EventLog<GameEvent>(100_000);
  const world = createWorld(DEFAULT_COURSE, log, { seed: 1, humans: ['player', 'tess'] });
  const hashes: number[] = [];
  const lastTick = COUNTDOWN_TICKS + RACE_LIMIT_TICKS + 1;
  while (world.race.phase !== 'finished' && world.tick < lastTick) {
    stepRace(world, inputsAt(world.tick + 1), TICK_DT);
    if (world.tick % HASH_EVERY === 0) hashes.push(hashWorld(world));
  }
  return {
    hashes,
    finalHash: hashWorld(world),
    finished: eventsIn(log, 'race.finished'),
    takeovers: eventsIn(log, 'racer.takeover'),
  };
}

describe('two peers stepping the same race from the same inputs', () => {
  it(
    'stay in the same state at every check, through an AI takeover, to the same result',
    () => {
      const host = runPeer(scriptedInputs);
      const guest = runPeer(scriptedInputs);

      expect(host.takeovers).toEqual([{ type: 'racer.takeover', id: 'tess' }]);
      expect(host.finished).toHaveLength(1);
      expect(host.hashes.length).toBeGreaterThan(TESS_LEAVES_AT / HASH_EVERY);
      expect(guest.hashes).toEqual(host.hashes);
      expect(guest.finalHash).toBe(host.finalHash);
      expect(guest.finished).toEqual(host.finished);
      expect(guest.takeovers).toEqual(host.takeovers);
    },
    TWO_RACES_TIMEOUT_MS,
  );

  it(
    'show a mismatch at the first check after one input differs on one peer',
    () => {
      const differsAt = 900;
      const host = runPeer(scriptedInputs);
      const guest = runPeer((tick) => {
        const inputs = scriptedInputs(tick);
        return tick === differsAt ? { ...inputs, tess: { ...(inputs.tess ?? IDLE), kick: true } } : inputs;
      });

      const checksBefore = differsAt / HASH_EVERY - 1;
      expect(guest.hashes.slice(0, checksBefore)).toEqual(host.hashes.slice(0, checksBefore));
      expect(guest.hashes[checksBefore]).not.toBe(host.hashes[checksBefore]);
    },
    TWO_RACES_TIMEOUT_MS,
  );
});
