/**
 * Gravity wells in a parsed level: reading them from the course, the pull they put on a point, and
 * which points a black hole holds. Pure functions over `Level.wells`; what a pull or a horizon does
 * to a racer is the medium's rule (only one with `effects.gravityWells` races a level that has any).
 */
import { length } from '../num.ts';
import { type Level, TILE, type Vec, type Well, type WellDef } from '../types.ts';
import { errorAt } from './level-error.ts';

/**
 * The wells of a level `width` by `height` tiles, each centred on its tile with its reach and
 * horizon in pixels.
 *
 * @throws {LevelError} At the well's tile for a centre off the map, a `reach` or `pull` that isn't
 *   positive, or a `horizon` that isn't positive or isn't smaller than its `reach`.
 */
export function parseWells(defs: readonly WellDef[], width: number, height: number): Well[] {
  return defs.map(({ col, row, reach, pull, horizon }) => {
    if (col < 0 || col >= width || row < 0 || row >= height)
      throw errorAt('A gravity well is centred off the map', row, col);
    if (!(reach > 0)) throw errorAt(`A gravity well's reach must be positive, not ${reach},`, row, col);
    if (!(pull > 0)) throw errorAt(`A gravity well's pull must be positive, not ${pull},`, row, col);
    if (horizon !== undefined && !(horizon > 0 && horizon < reach)) {
      throw errorAt(
        `A black hole's horizon must be positive and smaller than its reach (${reach}), not ${horizon},`,
        row,
        col,
      );
    }
    return {
      centre: { x: (col + 0.5) * TILE, y: (row + 0.5) * TILE },
      reach: reach * TILE,
      pull,
      horizon: horizon === undefined ? null : horizon * TILE,
    };
  });
}

/**
 * The pull on `point`, px/s², summed over the level's wells: each pulls toward its centre with
 * `pull * (1 - d / reach)` at distance `d` inside its reach, and not at all at its centre (where
 * there is no direction) or from the reach outward.
 */
export function pullAt(level: Level, point: Vec): Vec {
  const total = { x: 0, y: 0 };
  for (const well of level.wells) {
    const dx = well.centre.x - point.x;
    const dy = well.centre.y - point.y;
    const distance = length(dx, dy);
    if (distance === 0 || distance >= well.reach) continue;
    const strength = well.pull * (1 - distance / well.reach);
    total.x += (dx / distance) * strength;
    total.y += (dy / distance) * strength;
  }
  return total;
}

/** The black hole whose horizon holds `point`, or null; a planet has no horizon and never holds one. */
export function holeAt(level: Level, point: Vec): Well | null {
  return level.wells.find((well) => well.horizon !== null && distanceTo(well, point) < well.horizon) ?? null;
}

/** True when `point` is inside the reach of some black hole, where a racer is being drawn in. */
export function inHoleReach(level: Level, point: Vec): boolean {
  return level.wells.some((well) => well.horizon !== null && distanceTo(well, point) < well.reach);
}

function distanceTo(well: Well, point: Vec): number {
  return length(well.centre.x - point.x, well.centre.y - point.y);
}
