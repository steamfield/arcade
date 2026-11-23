/**
 * The race's referee: countdown, each racer's progress, finishes, places and
 * when the race is over. Reads bodies; never moves them.
 */

import { playerOf } from '../racers.ts';
import { RACER_IDS, type RaceResult, type Racer, TILE, type World } from '../types.ts';
import { progressAt } from './flowfield.ts';

/** Ticks from the first countdown beep to the start signal. */
export const COUNTDOWN_TICKS = 180;
/** Ticks the player gets after the third rival finishes before the race ends without them. */
export const DNF_GRACE_TICKS = 600;
/** Race ticks after which the race ends regardless. */
export const RACE_LIMIT_TICKS = 18000;

/** Ticks between the 3, 2, 1 beeps. */
const BEEP_INTERVAL_TICKS = 60;
const FIRST_BEEP = 3;

/**
 * Advances the race clock one tick. During the countdown it emits `race.countdown` at 0/60/120 and, on
 * reaching 180, `race.started`, switching to racing with `raceTick` 0. While racing it adds 1 to `raceTick`.
 * Returns true while the countdown is still running (racers stay put); false on the start tick and after.
 */
export function advanceClock(world: World): boolean {
  const race = world.race;
  if (race.phase !== 'countdown') {
    if (race.phase === 'racing') race.raceTick++;
    return false;
  }
  if (race.raceTick >= COUNTDOWN_TICKS) {
    race.phase = 'racing';
    race.raceTick = 0;
    world.events.emit({ type: 'race.started' });
    return false;
  }
  if (race.raceTick % BEEP_INTERVAL_TICKS === 0) {
    const n = FIRST_BEEP - race.raceTick / BEEP_INTERVAL_TICKS;
    if (n === 3 || n === 2 || n === 1) world.events.emit({ type: 'race.countdown', n });
  }
  race.raceTick++;
  return true;
}

/** Sets every unfinished racer's `progress` from the progress field. */
export function updateProgress(world: World): void {
  for (const racer of world.racers) {
    if (!racer.finished) racer.progress = progressAt(world.progress, racer.body);
  }
}

/**
 * Records racers whose centre crossed the finish line this tick and emits `racer.finished`.
 * Also notes the race tick on which the last rival finishes, which starts the DNF grace period.
 */
export function recordFinishes(world: World): void {
  if (world.race.phase !== 'racing') return;
  const lineX = world.level.finishX * TILE;
  const crossers = world.racers
    .filter((racer) => !racer.finished && centreX(racer) >= lineX)
    .sort((a, b) => centreX(b) - centreX(a) || racerOrder(a) - racerOrder(b));
  let place = world.racers.filter((racer) => racer.finished).length;
  for (const racer of crossers) {
    place++;
    racer.finished = { tick: world.race.raceTick, place, overshoot: centreX(racer) - lineX };
    // Out of play: nothing ticks these down any more, and views draw a latch from them.
    racer.status.latched = 0;
    racer.status.undertow = 0;
    world.events.emit({ type: 'racer.finished', id: racer.id, place, ticks: world.race.raceTick });
  }

  const rivalsDone = world.racers.every((racer) => racer.id === 'player' || racer.finished);
  if (rivalsDone && world.race.rivalsDoneAt === null) world.race.rivalsDoneAt = world.race.raceTick;
}

/** Ranks racers (finished by place, then by progress, ties by RACER_IDS) and emits `player.place` on change. */
export function updatePlaces(world: World): void {
  // The grid order is the standing during the countdown; announcing it would be noise.
  if (world.race.phase === 'countdown') return;
  const player = playerOf(world);
  const before = player.place;
  rankRacers(world.racers).forEach((racer, index) => {
    racer.place = index + 1;
  });
  if (player.place !== before) world.events.emit({ type: 'player.place', id: player.id, place: player.place });
}

/** Ends the race when the player finishes, the DNF grace expires or the time limit hits; emits `race.finished` once. */
export function checkRaceEnd(world: World): void {
  const race = world.race;
  if (race.phase !== 'racing') return;
  const player = playerOf(world);
  const graceOver = race.rivalsDoneAt !== null && race.raceTick >= race.rivalsDoneAt + DNF_GRACE_TICKS;
  const done =
    race.endsWhen === 'everyone' ? world.racers.every((racer) => racer.finished) : player.finished || graceOver;
  if (!done && race.raceTick < RACE_LIMIT_TICKS) return;

  const standings = rankRacers(world.racers).map((racer) => racer.id);
  const result: RaceResult = {
    standings,
    playerPlace: standings.indexOf('player') + 1,
    playerTicks: player.finished?.tick ?? null,
  };
  race.phase = 'finished';
  // Nothing steps once the race is over, so squids, decoys and riptides would hang frozen in the water.
  world.squids = [];
  world.decoys = [];
  world.riptides = [];
  race.result = result;
  world.events.emit({ type: 'race.finished', ...result });
}

/** Racers best first: finishers by finishing place, then the rest by least progress left, ties by RACER_IDS. */
function rankRacers(racers: readonly Racer[]): Racer[] {
  return [...racers].sort((a, b) => compareFinished(a, b) || compareProgress(a, b) || racerOrder(a) - racerOrder(b));
}

function compareFinished(a: Racer, b: Racer): number {
  if (a.finished && b.finished) return a.finished.place - b.finished.place;
  if (a.finished) return -1;
  if (b.finished) return 1;
  return 0;
}

/** Compares without subtracting, since two racers off the field both read Infinity. */
function compareProgress(a: Racer, b: Racer): number {
  if (a.progress < b.progress) return -1;
  if (a.progress > b.progress) return 1;
  return 0;
}

function racerOrder(racer: Racer): number {
  return RACER_IDS.indexOf(racer.id);
}

function centreX(racer: Racer): number {
  return racer.body.x + racer.body.w / 2;
}
