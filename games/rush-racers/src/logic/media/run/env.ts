/**
 * What a runner's surroundings do to it this tick: whether it stands on something (from the motion
 * state `afterRunMove` set last tick), and the cell under its centre, where currents are wind and
 * kelp is mud. A Tailwind (Riptide) lane over the runner replaces the cell's wind, as it does a
 * swimmer's current. A Mud Pie's patch under the runner's feet is mud too.
 */
import { sampleEnvironment } from '../../level/query.ts';
import { feltCurrent } from '../../powerups/riptides.ts';
import { feetInMud } from '../../powerups/twists/mud-pie.ts';
import type { Racer, World } from '../../types.ts';
import { type RunEnv, runMotion } from './data.ts';

/**
 * Run's `sampleEnvironment`.
 *
 * @throws {Error} When the racer's motion isn't run's.
 */
export function sampleRunEnvironment(world: World, racer: Racer): RunEnv {
  const cell = sampleEnvironment(world.level, racer.body);
  const wind = feltCurrent(world, racer, cell.current);
  const grounded = runMotion(racer.motion).grounded;
  const inMud = cell.inKelp || (grounded && feetInMud(world, racer));
  return { kind: 'run', grounded, wind, inMud };
}
