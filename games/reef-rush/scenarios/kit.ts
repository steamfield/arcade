import { scenarioKit } from '@arcade/testing';
import type { Action } from '../src/engine/input.ts';
import { COUNTDOWN_TICKS, RACE_LIMIT_TICKS } from '../src/logic/race/standings.ts';

export const { scenario, hold, tap, wait } = scenarioKit<Action>();

/**
 * A save on Hard, the tuning the routes below were recorded on. A fresh save races on Easy, so a
 * scenario whose route depends on Hard's clam rolls or speeds starts from this save (on the title,
 * where loadState lands) and swims `TITLE_TO_RACE` first. `races: 0` keeps the race seed equal to
 * the scenario's `seed`.
 */
export const HARD_SAVE = {
  version: 5,
  savedAt: '2026-11-22T00:00:00.000Z',
  data: {
    best: { easy: null, normal: null, hard: null },
    races: 0,
    settings: { muted: false, reducedMotion: null, difficulty: 'hard' },
    character: 'rudy',
  },
};

/** Title Race, then race as the saved pick once the select screen has armed (fire on both): lands on the countdown's first tick. */
export const TITLE_TO_RACE = [wait(25), tap('fire'), wait(25), tap('fire')];

/**
 * Ticks from the start of a race to a results screen that has been up long enough to take input,
 * for a player who never swims. The race limit ends any race, so this holds whatever the rivals'
 * tuning: the countdown, the limit, the 90 ticks before results show, then 30 more, past the
 * menu's 20 ticks of ignoring fire presses. An idle race usually ends sooner, when the rivals finish.
 */
export const IDLE_TO_RESULTS = COUNTDOWN_TICKS + RACE_LIMIT_TICKS + 90 + 30;

/** Ticks of TOP_ROUTE's last step, a hold right that crosses the finish and runs on 30 ticks past it. */
export const TOP_ROUTE_LAST_HOLD = 275;

/**
 * Swims the whole course without kicks or items on the default seed (1), from the start of the
 * countdown. Through the reef: up to row 4, a short climb past the urchin at (32,4), along the top,
 * down past the pillar, along the dive floor, through the arch and up the rising current. Then up
 * into the current highway, out and down into the jelly corridor, straight across the jelly field
 * (the jellies and the urchin tube cost it several hits), through the urchin tube, up the chimney
 * before the coral gate and along the top over it, down the far side onto the ledge row just under
 * its pearls (below the ceiling urchins), and into the drop to the finish at column 611 (race tick
 * 9006). The race ends on its own 10 s after the last rival finishes, which is race tick 9376 here,
 * so the route has 370 ticks in hand; `top-route.test.ts` fails if that margin drops below 300.
 *
 * Results come up about 60 ticks after it ends. The route is tied to OCEAN_LEVEL and to the rivals'
 * tuning (they bump and hit the player, and the pace they hold decides when the race would end on
 * its own); reshaping either means re-recording it. It never relies on a rival breaking the gate.
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
  hold('up', 43),
  hold('right', 6),
  hold(['right', 'down'], 31),
  hold('right', 239),
  hold(['right', 'up'], 68),
  hold('up', 30),
  hold('right', 523),
  hold(['right', 'down'], 68),
  hold('down', 63),
  hold('right', 5),
  hold(['right', 'up'], 32),
  hold('right', 843),
  hold(['right', 'down'], 76),
  hold('right', 3),
  hold(['right', 'up'], 64),
  hold('right', 26),
  hold(['right', 'down'], 8),
  hold('right', TOP_ROUTE_LAST_HOLD),
];
