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
 * countdown, going over the coral gate rather than through it. Re-recorded when the course gained its surface
 * section, its cave, more eels and hunting Hard sharks, by steering along the medium's aim (`Medium.aimFrom`, 3 tiles ahead)
 * snapped to the eight key directions, with a diagonal nudge for 24 ticks whenever it sat pinned on a
 * corner, so it takes whatever hits that line runs into. It crosses the finish at tick 10473, ahead of
 * at least one rival, so the race is still on when it crosses; `top-route.test.ts` fails if that margin drops below 300.
 *
 * Results come up about 60 ticks after it ends. The route is tied to OCEAN_LEVEL and to the rivals'
 * tuning (they bump and hit the player, and the pace they hold decides when the race would end on
 * its own); reshaping either means re-recording it. It never relies on a rival breaking the gate.
 */
export const TOP_ROUTE = [
  wait(180),
  hold(['right', 'down'], 50),
  hold('right', 139),
  hold(['right', 'down'], 30),
  hold('right', 20),
  hold(['right', 'down'], 12),
  hold(['right', 'up'], 12),
  hold('right', 120),
  hold(['right', 'up'], 14),
  hold('up', 73),
  hold(['right', 'up'], 2),
  hold('right', 76),
  hold(['right', 'down'], 49),
  hold('down', 53),
  hold(['right', 'down'], 10),
  hold('right', 55),
  hold(['right', 'down'], 15),
  hold('right', 439),
  hold(['right', 'up'], 28),
  hold('right', 14),
  hold(['right', 'up'], 43),
  hold('right', 75),
  hold(['right', 'down'], 3),
  hold('right', 12),
  hold(['right', 'down'], 3),
  hold('right', 521),
  hold(['right', 'up'], 53),
  hold('right', 126),
  hold(['right', 'up'], 10),
  hold('right', 616),
  hold(['right', 'down'], 113),
  hold('right', 28),
  hold(['right', 'up'], 51),
  hold('right', 277),
  hold(['right', 'up'], 94),
  hold('right', 300),
  hold(['right', 'up'], 11),
  hold('right', 669),
  hold(['right', 'up'], 31),
  hold('right', 317),
  hold(['right', 'up'], 46),
  hold('right', 1242),
  hold(['right', 'up'], 1),
  hold('right', 9),
  hold(['right', 'up'], 41),
  hold('right', 692),
  hold(['right', 'up'], 27),
  hold('right', 1321),
  hold(['right', 'up'], 95),
  hold('right', 321),
  hold(['right', 'up'], 77),
  hold('up', 6),
  hold(['right', 'up'], 1),
  hold('right', 521),
  hold(['right', 'down'], 74),
  hold('down', 12),
  hold(['right', 'down'], 99),
  hold('right', 325),
  hold(['right', 'up'], 14),
  hold('right', 62),
  hold(['right', 'down'], 1),
  hold('right', 114),
  hold(['right', 'down'], 1),
  hold('right', 22),
  hold(['right', 'down'], 18),
  hold(['right', 'up'], 6),
  hold('right', 19),
  hold(['right', 'up'], 40),
  hold('up', 13),
  hold(['right', 'up'], 3),
  hold('right', 27),
  hold(['right', 'down'], 13),
  hold('right', 3),
  hold(['right', 'down'], 10),
  hold('right', 289),
  hold(['right', 'down'], 3),
  hold('right', 11),
  hold(['right', 'down'], 2),
  hold('right', 7),
  hold(['right', 'down'], 36),
  hold('down', 20),
  hold(['right', 'down'], 13),
  hold('right', 283),
];
