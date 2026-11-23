/**
 * Drift's rival pilot (`Medium.steer`): where a rival wants to be going, and the stick that takes
 * its velocity there.
 */
import type { MoveModifiers, Racer, World } from '../../types.ts';
import type { AiDraws, Steering } from '../types.ts';
import { driftAimFrom } from './way.ts';
import { type DriftPilot, driftPilot } from './way-data.ts';

/** Ticks of the sideways push a recovery holds. */
const RECOVER_TICKS = 20;
/** Tiles down the steer field a rival aims at. */
const LOOKAHEAD_TILES = 3;

/** A drift rival's pilot memory at the start line. */
export function createDriftPilot(): DriftPilot {
  return { kind: 'drift', aim: { x: 0, y: 0 }, recoverTicks: 0, recoverDir: { x: 0, y: 0 } };
}

/**
 * A drift rival's steering this tick. Mutates only its pilot memory. `forceRecover` starts a stuck
 * recovery now unless one is already running.
 *
 * @throws {Error} When `racer.ai` is null (a human drives it), or its memory or the world's nav isn't drift's.
 */
export function steerDrifter(
  world: World,
  racer: Racer,
  _mods: MoveModifiers,
  draws: AiDraws,
  forceRecover: boolean,
): Steering {
  const ai = racer.ai;
  if (!ai) throw new Error(`drift.steer needs AI memory, but racer '${racer.id}' has none (a human drives it)`);
  const memory = driftPilot(ai.pilot);
  memory.aim = driftAimFrom(world, racer.body, LOOKAHEAD_TILES);
  if (forceRecover && memory.recoverTicks === 0) {
    const side = draws.side < 0.5 ? 1 : -1;
    memory.recoverTicks = RECOVER_TICKS;
    memory.recoverDir = { x: -memory.aim.y * side, y: memory.aim.x * side };
  }
  if (memory.recoverTicks > 0) {
    memory.recoverTicks--;
    return { move: { ...memory.recoverDir }, kick: false, kickHeld: false, aim: memory.aim, recovering: true };
  }
  return { move: { ...memory.aim }, kick: false, kickHeld: false, aim: memory.aim, recovering: false };
}
