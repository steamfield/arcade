import { scenarioKit } from '@arcade/testing';
import type { Action } from '../src/engine/input.ts';
import { COUNTDOWN_TICKS, RACE_LIMIT_TICKS } from '../src/logic/race/standings.ts';

export const { scenario, hold, tap, wait } = scenarioKit<Action>();

/**
 * Ticks from the start of a race to a results screen that has been up long enough to take input,
 * for a player who never swims. The race limit ends any race, so this holds whatever the rivals'
 * tuning: the countdown, the limit, the 90 ticks before results show, then 30 more, past the
 * menu's 20 ticks of ignoring kicks. An idle race usually ends sooner, when the rivals finish.
 */
export const IDLE_TO_RESULTS = COUNTDOWN_TICKS + RACE_LIMIT_TICKS + 90 + 30;

/** Ticks of TOP_ROUTE's last step, a hold right that crosses the finish and runs on 30 ticks past it. */
export const TOP_ROUTE_LAST_HOLD = 1123;

/**
 * Swims the whole course without kicks on the default seed (1), from the start of the countdown.
 * Through the reef: up to row 4, a short climb past the urchin at (32,4), along the top, down past
 * the pillar, along the dive floor, through the arch and up the rising current. Then up into the
 * current highway, out and down into the jelly corridor, straight across the jelly field (it takes
 * two jelly hits there), through the urchin tube to the coral gate, up the chimney and over it,
 * down onto the last ledge below its urchins, and into the drop to the finish at column 611
 * (race tick 8702).
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
  hold('right', 4080),
  hold(['right', 'up'], 90),
  hold('up', 40),
  hold('right', 540),
  hold(['right', 'down'], 150),
  hold('right', TOP_ROUTE_LAST_HOLD),
];
