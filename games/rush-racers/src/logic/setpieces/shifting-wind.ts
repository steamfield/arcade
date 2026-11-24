/**
 * Shifting wind, Thunderhead Pass' set piece: a zone whose gust pushes racers along x and flips
 * direction on a timer that is a pure function of the race tick, after a warning (`LevelDef.shiftingWind`).
 *
 * Each zone runs a cycle of `periodTicks` race ticks shifted by `offsetTicks`: it blows toward +x for
 * the first half and toward -x for the second. `SHIFTING_WIND.warnTicks` before each turn it warns,
 * naming the coming direction. A medium feels the gust through `shiftingWindAt`, as it feels a wind
 * or current cell (flight reads it in `media/flight/env.ts`); this module announces the turns.
 */
import { LevelError } from '../level/level-error.ts';
import { type LightningZone, type Racer, type ShiftingWindDef, TILE, type Vec, type World } from '../types.ts';

/** Which way along x a zone's gust blows: 1 toward +x, -1 toward -x. */
export type WindDirection = -1 | 1;

/** The timing every shifting wind zone shares. */
export const SHIFTING_WIND = {
  /** Ticks of warning before each turn. */
  warnTicks: 60,
  /** The shortest cycle: each half must hold a whole warning with room to fly in a steady gust. */
  minPeriodTicks: 240,
} as const;

/** The gust a racer feels in a zone: its direction along x and its push in px/s². */
export interface FeltWind {
  dir: WindDirection;
  push: number;
}

/**
 * Checks a level's shifting wind zones and returns copies in the order written.
 *
 * @param lightning The level's storm zones, which no wind zone may share a column with.
 * @throws {LevelError} For a zone reversed or off the map, two zones sharing a column, a zone sharing a
 *   column with a storm zone, a period or offset that isn't a whole number of ticks, a period under
 *   `SHIFTING_WIND.minPeriodTicks`, or a push that isn't positive.
 */
export function parseShiftingWind(
  defs: readonly ShiftingWindDef[],
  width: number,
  lightning: readonly LightningZone[] = [],
): ShiftingWindDef[] {
  const zones = defs.map((def, index) => requireZone(def, index, width));
  zones.forEach((zone, index) => {
    requireApartFromWind(zone, index, zones.slice(0, index));
    requireApartFromLightning(zone, index, lightning);
  });
  return zones;
}

/** A copy of one zone, checked on its own. */
function requireZone(def: ShiftingWindDef, index: number, width: number): ShiftingWindDef {
  const [from, to] = def.cols;
  if (from > to) throw new LevelError(`Shifting wind zone ${index} runs backwards from column ${from} to ${to}`);
  if (from < 0 || to >= width) {
    throw new LevelError(
      `Shifting wind zone ${index} covers columns ${from}-${to} but the map has columns 0-${width - 1}`,
    );
  }
  requireWholeTicks(index, 'period', def.periodTicks);
  requireWholeTicks(index, 'offset', def.offsetTicks);
  if (def.periodTicks < SHIFTING_WIND.minPeriodTicks) {
    throw new LevelError(
      `Shifting wind zone ${index} turns every ${def.periodTicks / 2} ticks (period ${def.periodTicks}); ` +
        `use a period of at least ${SHIFTING_WIND.minPeriodTicks} so each half holds its ${SHIFTING_WIND.warnTicks}-tick warning`,
    );
  }
  // Written so NaN fails too.
  if (!(def.push > 0)) {
    throw new LevelError(`Shifting wind zone ${index} has push ${def.push}; use a positive push in px/s²`);
  }
  return { cols: [from, to], periodTicks: def.periodTicks, offsetTicks: def.offsetTicks, push: def.push };
}

/** Throws unless `ticks` is a whole number: a timer of fractions or NaN never lands on a warning or turn tick. */
function requireWholeTicks(index: number, what: 'period' | 'offset', ticks: number): void {
  if (Number.isInteger(ticks)) return;
  throw new LevelError(`Shifting wind zone ${index} has ${what} ${ticks}; use whole ticks`);
}

/** Throws when `zone` shares a column with an earlier wind zone, so a racer is only ever in one gust. */
function requireApartFromWind(zone: ShiftingWindDef, index: number, earlier: readonly ShiftingWindDef[]): void {
  const other = earlier.findIndex((before) => sharesColumn(before.cols, zone.cols));
  if (other < 0) return;
  throw new LevelError(
    `Shifting wind zone ${index} (columns ${zone.cols.join('-')}) overlaps zone ${other} (columns ${earlier[other]?.cols.join('-')})`,
  );
}

/** Throws when `zone` shares a column with a storm zone, so a gust never carries a flyer through a strike it timed. */
function requireApartFromLightning(zone: ShiftingWindDef, index: number, lightning: readonly LightningZone[]): void {
  const storm = lightning.findIndex((strike) => sharesColumn(strike.cols, zone.cols));
  if (storm < 0) return;
  throw new LevelError(
    `Shifting wind zone ${index} (columns ${zone.cols.join('-')}) overlaps lightning zone ${storm} ` +
      `(columns ${lightning[storm]?.cols.join('-')}); move one of them`,
  );
}

function sharesColumn(a: readonly [number, number], b: readonly [number, number]): boolean {
  return a[0] <= b[1] && b[0] <= a[1];
}

/** How far into its current cycle `zone` is on `raceTick`, from 0 to `periodTicks - 1`. */
function cycleTick(zone: ShiftingWindDef, raceTick: number): number {
  const shifted = (raceTick + zone.offsetTicks) % zone.periodTicks;
  // `%` keeps the dividend's sign, so a negative tick needs a period added to land in the cycle.
  return shifted < 0 ? shifted + zone.periodTicks : shifted;
}

/** The cycle tick on which `zone` turns to -x; it turns back to +x on cycle tick 0. */
function halfPeriod(zone: ShiftingWindDef): number {
  return Math.floor(zone.periodTicks / 2);
}

/**
 * The way `zone` blows on race tick `raceTick`: +x for the first half of each cycle and -x for the
 * second. The race starts `offsetTicks` into the zone's first cycle. The same tick always gives the
 * same direction.
 */
export function windDirection(zone: ShiftingWindDef, raceTick: number): WindDirection {
  return cycleTick(zone, raceTick) < halfPeriod(zone) ? 1 : -1;
}

/**
 * Race ticks until `zone` next turns, counted from `raceTick`: 1 on the tick just before a turn,
 * and the whole half on a turn's own tick.
 */
export function ticksToTurn(zone: ShiftingWindDef, raceTick: number): number {
  const tick = cycleTick(zone, raceTick);
  const half = halfPeriod(zone);
  return tick < half ? half - tick : zone.periodTicks - tick;
}

/** True when `zone` is in the `SHIFTING_WIND.warnTicks` before a turn on `raceTick`. */
export function windWarning(zone: ShiftingWindDef, raceTick: number): boolean {
  return ticksToTurn(zone, raceTick) <= SHIFTING_WIND.warnTicks;
}

/** True when `point` (world px) lies in the zone's columns, at any height. */
function inZone(zone: ShiftingWindDef, point: Vec): boolean {
  return point.x >= zone.cols[0] * TILE && point.x < (zone.cols[1] + 1) * TILE;
}

/**
 * The gust of the zone over `point` (world px) on the world's current race tick, or null outside
 * every zone. A medium calls it with a racer's centre while sampling its surroundings.
 */
export function shiftingWindAt(world: World, point: Vec): FeltWind | null {
  const zone = world.level.shiftingWind.find((candidate) => inZone(candidate, point));
  if (!zone) return null;
  return { dir: windDirection(zone, world.race.raceTick), push: zone.push };
}

/**
 * The shifting wind slot of `stepRace`: emits `wind.warned {zone, dir}` (the coming direction) on the
 * first tick of each warning and `wind.shifted {zone, dir}` on each turn. Race tick 0 is the start
 * signal: a turn landing on it is not announced, and a race starting inside a warning announces that
 * warning on tick 0, so every turn after the start is warned first. The push itself reaches racers through `shiftingWindAt`, which each medium samples when it
 * moves them, so `_racing` and `_dt` go unused here.
 */
export function blowShiftingWind(world: World, _racing: readonly Racer[], _dt: number): void {
  const raceTick = world.race.raceTick;
  world.level.shiftingWind.forEach((zone, index) => {
    const dir = windDirection(zone, raceTick);
    const warnsNow = raceTick === 0 ? windWarning(zone, 0) : ticksToTurn(zone, raceTick) === SHIFTING_WIND.warnTicks;
    if (warnsNow) world.events.emit({ type: 'wind.warned', zone: index, dir: opposite(dir) });
    if (raceTick > 0 && isTurnTick(zone, raceTick)) world.events.emit({ type: 'wind.shifted', zone: index, dir });
  });
}

/** True on the cycle ticks a zone turns: 0 (to +x) and half the period (to -x). */
function isTurnTick(zone: ShiftingWindDef, raceTick: number): boolean {
  const tick = cycleTick(zone, raceTick);
  return tick === 0 || tick === halfPeriod(zone);
}

function opposite(dir: WindDirection): WindDirection {
  return dir === 1 ? -1 : 1;
}
