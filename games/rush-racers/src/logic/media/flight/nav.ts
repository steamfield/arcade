/**
 * Flight's navigation over a level: one distance to the finish over 8 neighbours with rock and
 * unbroken puff clouds (coral) closed, and a level check that every start can reach the finish
 * without popping one. Its nav is a `FlightNav` (`way-data.ts`); `way.ts` reads it.
 *
 * Scaffold baseline, ported from the conformance suite's glide: every open tile costs the same.
 * Phase 1 lane b prices fog, wind against the way and the bottom rows over open sky, and adds a
 * ram field for a dash through a puff cloud.
 */

import { distancesToFinish, type EntryCost, fieldAt } from '../../race/flowfield.ts';
import type { Level } from '../../types.ts';
import type { LevelProblem, MediumNav, MediumTuning } from '../types.ts';
import { type FlightNav, flightNav } from './way-data.ts';

/** Every open tile costs the same; rock and unbroken puff clouds are closed. */
export const flightCost: EntryCost = (cell, isBroken) => {
  if (cell === 'rock') return Number.POSITIVE_INFINITY;
  if (cell === 'coral' && !isBroken) return Number.POSITIVE_INFINITY;
  return 1;
};

/** Flight's nav for `level` with `broken` puff clouds open. */
export function buildFlightNav(level: Level, broken: ReadonlySet<number>, _tuning: MediumTuning): FlightNav {
  return {
    kind: 'flight',
    width: level.width,
    height: level.height,
    distance: distancesToFinish(level, broken, flightCost),
  };
}

/**
 * One problem for each start that can't reach the finish without popping a puff cloud, located at that start.
 *
 * @throws {Error} When `nav` was built by another medium.
 */
export function validateFlightLevel(level: Level, nav: MediumNav): LevelProblem[] {
  const flight = flightNav(nav);
  return level.starts.flatMap((start, index) =>
    Number.isFinite(fieldAt(flight.distance, flight, start))
      ? []
      : [
          {
            message: `Start ${index + 1} cannot reach the finish flying without popping a puff cloud`,
            row: start.y,
            col: start.x,
          },
        ],
  );
}
