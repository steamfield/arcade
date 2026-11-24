/**
 * Flight's test setup on top of the shared media kit: still air, a bare flyer stepped through
 * `applyFlightIntent`, and racing worlds on small inline flight courses. Re-exports the shared
 * helpers its tests use. Test-only; nothing in the game imports it.
 */
import type { EventLog } from '@arcade/core';
import type { GameEvent } from '../../events.ts';
import type { CharacterId, Intent, MoveModifiers, Racer } from '../../types.ts';
import { bareRacer, type LaneWorldOptions, laneWorld, stepBare } from '../test-kit.ts';
import type { MediumTuning } from '../types.ts';
import type { FlightEnv } from './data.ts';
import { applyFlightIntent, createFlightMotion } from './physics.ts';
import { FLIGHT_TUNING } from './tuning.ts';

export { RIVAL_LANE_ROWS, ticksIn, ticksOfRacer } from '../test-kit.ts';

/** Air with no wind and no fog. */
export const STILL_AIR: FlightEnv = { kind: 'flight', wind: null, inFog: false };

/** A flyer in slot 'player' at rest in open air, outside any world. */
export function bareFlyer(character: CharacterId = 'rudy'): Racer {
  return bareRacer(createFlightMotion, { character });
}

/**
 * Applies flight to a bare racer for `ticks` ticks with `input` (one intent, or one per tick
 * counted from 0), moving its body by its velocity after each; returns every tick's velocity and
 * body top (px) and the events emitted (stamped with the tick, from 0).
 */
export function fly(
  racer: Racer,
  ticks: number,
  input: Intent | ((tick: number) => Intent),
  options: { env?: FlightEnv; mods?: MoveModifiers; tuning?: MediumTuning; log?: EventLog<GameEvent> } = {},
) {
  const setup = {
    env: options.env ?? STILL_AIR,
    tuning: options.tuning ?? FLIGHT_TUNING,
    moveBody: true,
    ...(options.mods ? { mods: options.mods } : {}),
    ...(options.log ? { log: options.log } : {}),
  };
  return stepBare(applyFlightIntent, racer, ticks, input, setup, ({ body }) => ({
    vx: body.vx,
    vy: body.vy,
    y: body.y,
  }));
}

/** A racing flight world on `playerRows`; the rivals are walled off in their own lane above. */
export function flightWorld(playerRows: readonly string[], options: LaneWorldOptions = {}) {
  return laneWorld('flight', playerRows, options);
}
