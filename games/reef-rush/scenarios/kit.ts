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
export const TOP_ROUTE_LAST_HOLD = 283;

/**
 * Swims the whole course without dashes or items on the default seed (1), from the start of the
 * countdown, going over the coral gate rather than through it. Recorded in v2 phase 2 by steering
 * along the medium's aim (`Medium.aimFrom`, 3 tiles ahead) snapped to the eight key directions, so it
 * takes whatever hits that line runs into. It crosses the finish at race tick 8567; the race ends on
 * its own 10 s after the last rival finishes, at race tick 9146 here, so the route has 579 ticks in
 * hand; `top-route.test.ts` fails if that margin drops below 300.
 *
 * Results come up about 60 ticks after it ends. The route is tied to OCEAN_LEVEL and to the rivals'
 * tuning (they bump and hit the player, and the pace they hold decides when the race would end on
 * its own); reshaping either means re-recording it. It never relies on a rival breaking the gate.
 */
export const TOP_ROUTE = [
  wait(180),
  hold(['right', 'down'], 51),
  hold('right', 139),
  hold(['right', 'down'], 29),
  hold('right', 164),
  hold(['right', 'up'], 14),
  hold('up', 73),
  hold(['right', 'up'], 2),
  hold('right', 75),
  hold(['right', 'down'], 51),
  hold('down', 51),
  hold(['right', 'down'], 8),
  hold('right', 38),
  hold(['right', 'up'], 1),
  hold('right', 470),
  hold(['right', 'up'], 27),
  hold('right', 12),
  hold(['right', 'up'], 40),
  hold('right', 62),
  hold(['right', 'down'], 3),
  hold('right', 10),
  hold(['right', 'down'], 5),
  hold('right', 536),
  hold(['right', 'up'], 53),
  hold('right', 127),
  hold(['right', 'up'], 9),
  hold('right', 617),
  hold(['right', 'down'], 156),
  hold('right', 242),
  hold(['right', 'up'], 88),
  hold('right', 444),
  hold(['right', 'up'], 3),
  hold('right', 14),
  hold(['right', 'up'], 3),
  hold('right', 7),
  hold(['right', 'up'], 12),
  hold('right', 2),
  hold(['right', 'up'], 17),
  hold('right', 545),
  hold(['right', 'up'], 1),
  hold('right', 9),
  hold(['right', 'up'], 5),
  hold('right', 10),
  hold(['right', 'up'], 6),
  hold('right', 698),
  hold(['right', 'down'], 41),
  hold('right', 464),
  hold(['right', 'down'], 1),
  hold('right', 11),
  hold(['right', 'down'], 1),
  hold('right', 915),
  hold(['right', 'up'], 70),
  hold('right', 226),
  hold(['right', 'up'], 69),
  hold('up', 2),
  hold(['right', 'up'], 1),
  hold('right', 504),
  hold(['right', 'down'], 127),
  hold('right', 807),
  hold(['right', 'down'], 56),
  hold('right', 58),
  hold(['right', 'up'], 4),
  hold('right', 8),
  hold(['right', 'up'], 7),
  hold('right', 13),
  hold(['right', 'up'], 1),
  hold('right', TOP_ROUTE_LAST_HOLD),
];
