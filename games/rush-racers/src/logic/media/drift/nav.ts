/**
 * Drift's navigation: what a drifter pays to enter each tile, the field built from those prices,
 * and the level check that every start can reach the finish. Walking the field lives in `way.ts`.
 */
import { distancesToFinish, fieldAt } from '../../race/flowfield.ts';
import type { Cell, Level } from '../../types.ts';
import type { LevelProblem, MediumNav, MediumTuning } from '../types.ts';
import { type DriftNav, driftNav } from './way-data.ts';

/** Every open tile costs the same; asteroid rock and unbroken ice are closed. Drift's `enterCost`. */
export const driftCost = (cell: Cell, isBroken: boolean): number => {
  if (cell === 'rock') return Number.POSITIVE_INFINITY;
  if (cell === 'coral' && !isBroken) return Number.POSITIVE_INFINITY;
  return 1;
};

/** Drift's nav for `level` with `broken` ice open. */
export function buildDriftNav(level: Level, broken: ReadonlySet<number>, _tuning: MediumTuning): DriftNav {
  return {
    kind: 'drift',
    width: level.width,
    height: level.height,
    steer: distancesToFinish(level, broken, driftCost),
  };
}

/**
 * Why `level` can't be drifted: one problem for each start that can't reach the finish without
 * breaking ice, located at that start.
 *
 * @throws {Error} When `nav` was built by another medium.
 */
export function validateDriftLevel(level: Level, nav: MediumNav): LevelProblem[] {
  const drift = driftNav(nav);
  return level.starts.flatMap((start, index) =>
    Number.isFinite(fieldAt(drift.steer, drift, start))
      ? []
      : [{ message: `Start ${index + 1} cannot reach the finish without breaking ice`, row: start.y, col: start.x }],
  );
}
