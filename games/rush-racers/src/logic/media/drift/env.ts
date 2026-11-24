/**
 * What a drifter's surroundings do to it this tick: the cell under its centre, where currents are
 * solar wind and kelp is nebula dust. An Ion Stream (Riptide) lane over the drifter replaces the
 * cell's wind, as it does a swimmer's current. Gravity wells pull on it wherever it is inside a reach,
 * and so does any gravity bomb (Farside's Gas Bomb) dropped near it.
 */
import { sampleEnvironment } from '../../level/query.ts';
import { pullAt } from '../../level/wells.ts';
import { feltCurrent } from '../../powerups/riptides.ts';
import { bombPullOn } from '../../powerups/twists/gravity-bomb.ts';
import { centreOf } from '../../racers.ts';
import type { Racer, Vec, World } from '../../types.ts';
import { effectiveTuning } from '../index.ts';
import type { DriftEnv } from './data.ts';
import { driftExtras } from './tuning.ts';

/**
 * Drift's `sampleEnvironment`. Its `pull` is the wells' (`driftPullAt`) plus the gravity bombs'
 * (`bombPullOn`), both times the tuning's `wellPull`.
 *
 * @throws {Error} When the world's tuning lacks one of drift's extras.
 */
export function sampleDriftEnvironment(world: World, racer: Racer): DriftEnv {
  const cell = sampleEnvironment(world.level, racer.body);
  const wells = driftPullAt(world, centreOf(racer));
  const bombs = scaledByWellPull(world, bombPullOn(world, racer));
  return {
    kind: 'drift',
    wind: feltCurrent(world, racer, cell.current),
    inDust: cell.inKelp,
    pull: { x: wells.x + bombs.x, y: wells.y + bombs.y },
  };
}

/**
 * What the level's gravity wells do to a drifter at `point`, px/s²: `pullAt` times the tuning's
 * `wellPull` (lower on Easy). The physics reads it through `DriftEnv.pull` and the pilot calls this,
 * so rivals plan round the wells but not round gravity bombs.
 *
 * @throws {Error} When the world's tuning lacks one of drift's extras.
 */
export function driftPullAt(world: World, point: Vec): Vec {
  return scaledByWellPull(world, pullAt(world.level, point));
}

/**
 * `pull` times the tuning's `wellPull`, the one place that product is taken.
 *
 * @throws {Error} When the world's tuning lacks one of drift's extras.
 */
function scaledByWellPull(world: World, pull: Vec): Vec {
  const { wellPull } = driftExtras(effectiveTuning(world));
  return { x: pull.x * wellPull, y: pull.y * wellPull };
}
