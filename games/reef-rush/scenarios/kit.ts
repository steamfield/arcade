import { scenarioKit } from '@arcade/testing';
import type { Action } from '../src/engine/input.ts';

export const { scenario, hold, tap, wait } = scenarioKit<Action>();

/**
 * Swims the first section's top route without kicks, from the start of the countdown: up to
 * row 4, a short climb past the urchin at (32,4), along the top, down past the pillar, along the
 * dive floor, through the arch and up to the finish. The route is tied to OCEAN_LEVEL; reshaping
 * the course means re-recording it.
 */
export const TOP_ROUTE = [
  wait(180),
  hold(['right', 'up'], 40),
  hold('right', 300),
  hold(['right', 'up'], 30),
  hold('right', 150),
  hold(['right', 'down'], 30),
  hold('down', 90),
  hold('right', 300),
  hold(['right', 'up'], 40),
  hold('right', 520),
];
