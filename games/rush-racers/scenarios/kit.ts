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

/**
 * Title Race, then the course the cursor starts on (the course in force) once course select has
 * armed: lands on the select screen's first tick.
 */
export const TITLE_TO_SELECT = [wait(25), tap('fire'), wait(25), tap('fire')];

/** `TITLE_TO_SELECT`, then race as the saved pick once select has armed: lands on the countdown's first tick. */
export const TITLE_TO_RACE = [...TITLE_TO_SELECT, wait(25), tap('fire')];

/**
 * Ticks from the start of a race to a results screen that has been up long enough to take input,
 * for a player who never swims. The race limit ends any race, so this holds whatever the rivals'
 * tuning: the countdown, the limit, the 90 ticks before results show, then 30 more, past the
 * menu's 20 ticks of ignoring fire presses. An idle race usually ends sooner, when the rivals finish.
 */
export const IDLE_TO_RESULTS = COUNTDOWN_TICKS + RACE_LIMIT_TICKS + 90 + 30;

/** Ticks of TOP_ROUTE's last step, a hold right that crosses the finish and runs on 30 ticks past it. */
export const TOP_ROUTE_LAST_HOLD = 336;

/**
 * Swims the whole course without dashes or items on the default seed (1), from the start of the
 * countdown, going over the coral gate rather than through it. Recorded in v2 phase 4 (enemies on the course, v2 balance) by steering
 * along the medium's aim (`Medium.aimFrom`, 3 tiles ahead) snapped to the eight key directions, so it
 * takes whatever hits that line runs into (four jellies and a shark on seed 1). It crosses the finish
 * at race tick 8631; the race ends on its own 10 s after the last rival finishes, at race tick 9160
 * here, so the route has 529 ticks in hand; `top-route.test.ts` fails if that margin drops below 300.
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
  hold(['right', 'up'], 23),
  hold('right', 17),
  hold(['right', 'up'], 2),
  hold('right', 5),
  hold(['right', 'up'], 32),
  hold('right', 418),
  hold(['right', 'up'], 81),
  hold('right', 83),
  hold(['right', 'up'], 6),
  hold('right', 626),
  hold(['right', 'down'], 112),
  hold('right', 46),
  hold(['right', 'up'], 5),
  hold('right', 13),
  hold(['right', 'up'], 7),
  hold('right', 267),
  hold(['right', 'up'], 115),
  hold('right', 394),
  hold(['right', 'up'], 1),
  hold('right', 12),
  hold(['right', 'up'], 3),
  hold('right', 14),
  hold(['right', 'up'], 1),
  hold('right', 229),
  hold(['right', 'up'], 3),
  hold('right', 7),
  hold(['right', 'up'], 8),
  hold('right', 2),
  hold(['right', 'up'], 15),
  hold('right', 286),
  hold(['right', 'up'], 7),
  hold('right', 4),
  hold(['right', 'up'], 12),
  hold('right', 8),
  hold(['right', 'up'], 7),
  hold('right', 596),
  hold(['right', 'down'], 17),
  hold('right', 1633),
  hold(['right', 'up'], 60),
  hold('right', 322),
  hold(['right', 'up'], 63),
  hold('up', 13),
  hold(['right', 'up'], 2),
  hold('right', 516),
  hold(['right', 'down'], 153),
  hold('right', 775),
  hold(['right', 'down'], 60),
  hold('right', 58),
  hold(['right', 'up'], 6),
  hold('right', 8),
  hold(['right', 'up'], 7),
  hold('right', TOP_ROUTE_LAST_HOLD),
];
