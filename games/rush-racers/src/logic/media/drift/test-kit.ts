/**
 * Drift's test setup on top of the shared media kit: open space, a bare drifter stepped through
 * `applyDriftIntent`, and racing worlds on small inline drift courses. Re-exports the shared
 * helpers its tests use. Test-only; nothing in the game imports it.
 */
import type { EventLog } from '@arcade/core';
import type { GameEvent } from '../../events.ts';
import { length } from '../../num.ts';
import type { CharacterId, Intent, MoveModifiers, Racer } from '../../types.ts';
import { bareRacer, type LaneWorldOptions, laneWorld, stepBare } from '../test-kit.ts';
import type { MediumTuning } from '../types.ts';
import type { DriftEnv } from './data.ts';
import { applyDriftIntent, createDriftMotion } from './physics.ts';
import { DRIFT_TUNING } from './tuning.ts';

export { RIVAL_LANE_ROWS, ticksIn, ticksOfRacer } from '../test-kit.ts';

/** Open space with no solar wind and no dust. */
export const VACUUM: DriftEnv = { kind: 'drift', wind: null, inDust: false, pull: { x: 0, y: 0 } };

/** A drifter in slot 'player' at rest in open space, outside any world. */
export function bareDrifter(character: CharacterId = 'rudy'): Racer {
  return bareRacer(createDriftMotion, { character });
}

/**
 * Applies drift to a bare racer for `ticks` ticks with `input` (one intent, or one per tick counted
 * from 0), moving its body by its velocity after each; returns every tick's velocity and speed and
 * the events emitted (stamped with the tick, from 0).
 */
export function drift(
  racer: Racer,
  ticks: number,
  input: Intent | ((tick: number) => Intent),
  options: { env?: DriftEnv; mods?: MoveModifiers; tuning?: MediumTuning; log?: EventLog<GameEvent> } = {},
) {
  const setup = {
    env: options.env ?? VACUUM,
    tuning: options.tuning ?? DRIFT_TUNING,
    moveBody: true,
    ...(options.mods ? { mods: options.mods } : {}),
    ...(options.log ? { log: options.log } : {}),
  };
  return stepBare(applyDriftIntent, racer, ticks, input, setup, ({ body }) => ({
    vx: body.vx,
    vy: body.vy,
    speed: length(body.vx, body.vy),
  }));
}

/** A racing drift world on `playerRows`; the rivals are walled off in their own lane above. */
export function driftWorld(playerRows: readonly string[], options: LaneWorldOptions = {}) {
  return laneWorld('drift', playerRows, options);
}
