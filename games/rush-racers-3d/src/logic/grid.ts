import { RACE, RUN } from './tuning.ts';
import type { Course, RacerId } from './types.ts';

const GRID_LANE: Record<RacerId, number> = { player: -0.5, r1: 0.5, r2: -1.5, r3: 1.5 };

/** Returns the slot's lateral position on the four-racer grid, narrowed to fit the course edges. */
export function gridD(course: Course, id: RacerId): number {
  const edge = Math.max(0, course.halfWidth - RUN.radius);
  const spacing = Math.min(RACE.gridSpacing, edge / 1.5);
  return GRID_LANE[id] * spacing;
}
