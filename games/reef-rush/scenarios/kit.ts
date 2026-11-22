import { scenarioKit } from '@arcade/testing';
import type { Action } from '../src/engine/input.ts';

export const { scenario, hold, tap, wait } = scenarioKit<Action>();

/** Ticks of TOP_ROUTE's last step, a hold right that crosses the finish and runs on 30 ticks past it. */
export const TOP_ROUTE_LAST_HOLD = 1280;

/**
 * Swims the whole course without kicks on the default seed (1), from the start of the countdown.
 * Through the reef: up to row 4, a short climb past the urchin at (32,4), along the top, down past
 * the pillar, along the dive floor, through the arch and up the rising current. Then up into the
 * current highway, out and down into the jelly corridor, straight across the jelly field (it takes
 * three jelly hits there), into the urchin tube, up the chimney and over the coral gate, down onto
 * the last ledge below its urchins, and into the drop to the finish at column 611 (race tick 8862).
 *
 * Results come up about 60 ticks after it ends. The route is tied to OCEAN_LEVEL and to the rivals'
 * tuning (they bump the player); reshaping either means re-recording it.
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
  hold('right', 660),
  hold(['right', 'up'], 70),
  hold('right', 930),
  hold(['right', 'down'], 70),
  hold('right', 2640),
  hold(['right', 'up'], 30),
  hold('right', 1410),
  hold(['right', 'up'], 90),
  hold('up', 40),
  hold('right', 540),
  hold(['right', 'down'], 150),
  hold('right', TOP_ROUTE_LAST_HOLD),
];
