import { scenarioKit } from '@arcade/testing';
import type { Action } from '../src/engine/input.ts';

export const { scenario, hold, tap, wait } = scenarioKit<Action>();

/**
 * Swims the first section's top route without kicks, from the start of the countdown:
 * along row 4 over the pillar, down past it, along the dive floor, through the arch and
 * up to the finish. The route is tied to OCEAN_LEVEL; reshaping the course means
 * re-recording it. The player crosses the line about 30 ticks before the last step ends.
 */
export const TOP_ROUTE = [
  wait(180),
  hold(['right', 'up'], 40),
  hold('right', 480),
  hold('down', 120),
  hold('right', 300),
  hold(['right', 'up'], 40),
  hold('right', 520),
];
