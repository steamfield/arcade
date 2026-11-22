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
export const TOP_ROUTE_LAST_HOLD = 1141;

/**
 * Swims the whole course without kicks on the default seed (1), from the start of the countdown.
 * Through the reef: up to row 4, a short climb past the urchin at (32,4), along the top, down past
 * the pillar, along the dive floor, through the arch and up the rising current. Then up into the
 * current highway, out and down into the jelly corridor, straight across the jelly field (the jellies
 * and the urchin tube cost it several hits), through the urchin tube to the coral gate, up the chimney
 * and over it, down onto the last ledge below its urchins, and into the drop to the finish at
 * column 611 (race tick 8372). The race ends on its own 10 s after the last rival finishes, which is race tick 8797
 * here, so the route has 425 ticks in hand; `top-route.test.ts` fails if that margin drops below 300.
 *
 * Results come up about 60 ticks after it ends. The route is tied to OCEAN_LEVEL and to the rivals'
 * tuning (they bump the player, and the pace they hold decides when the race would end on its own);
 * reshaping either means re-recording it.
 */
export const TOP_ROUTE = [
  wait(180),
  hold(['right', 'up'], 10),
  hold('right', 330),
  hold(['right', 'up'], 30),
  hold('right', 158),
  hold(['right', 'down'], 30),
  hold('down', 90),
  hold('right', 375),
  hold(['right', 'up'], 48),
  hold('right', 600),
  hold(['right', 'up'], 70),
  hold('right', 967),
  hold(['right', 'down'], 62),
  hold('right', 3812),
  hold(['right', 'up'], 52),
  hold('up', 52),
  hold('right', 456),
  hold(['right', 'down'], 120),
  hold('right', TOP_ROUTE_LAST_HOLD),
];
