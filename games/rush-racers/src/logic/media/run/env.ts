/**
 * What a runner's surroundings do to it this tick. Scaffold baseline: only whether it stands on
 * something, from the motion state `afterRunMove` set last tick. Phase 2 lane a owns this file.
 */
import type { Racer, World } from '../../types.ts';
import { type RunEnv, runMotion } from './data.ts';

/**
 * Run's `sampleEnvironment`.
 *
 * @throws {Error} When the racer's motion isn't run's.
 */
export function sampleRunEnvironment(_world: World, racer: Racer): RunEnv {
  return { kind: 'run', grounded: runMotion(racer.motion).grounded };
}
