/**
 * What a runner's surroundings do to it this tick: whether it stands on something (from the motion
 * state `afterRunMove` set last tick), and the cell under its centre, where currents are wind and
 * kelp is mud.
 */
import { sampleEnvironment } from '../../level/query.ts';
import type { Racer, World } from '../../types.ts';
import { type RunEnv, runMotion } from './data.ts';

/**
 * Run's `sampleEnvironment`.
 *
 * @throws {Error} When the racer's motion isn't run's.
 */
export function sampleRunEnvironment(world: World, racer: Racer): RunEnv {
  const cell = sampleEnvironment(world.level, racer.body);
  return { kind: 'run', grounded: runMotion(racer.motion).grounded, wind: cell.current, inMud: cell.inKelp };
}
