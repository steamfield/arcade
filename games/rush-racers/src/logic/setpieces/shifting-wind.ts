/**
 * Shifting wind, Thunderhead Pass' set piece: a zone whose gust pushes racers along x and flips
 * direction on a timer that is a pure function of the race tick, after a warning (`LevelDef.shiftingWind`).
 */
import type { Racer, ShiftingWindDef, World } from '../types.ts';

/**
 * Checks a level's shifting wind zones and returns them in the order written.
 *
 * @throws {LevelError} For a zone reversed or off the map, two zones sharing a column, or a period or push that isn't positive.
 */
export function parseShiftingWind(defs: readonly ShiftingWindDef[], width: number): ShiftingWindDef[] {
  if (defs.length === 0) return [];
  throw new Error(`parseShiftingWind not implemented (width ${width})`);
}

/** The shifting wind slot of `stepRace`: emits warnings and shifts, and pushes the racers in each zone. */
export function blowShiftingWind(world: World, racing: readonly Racer[], dt: number): void {
  if (world.level.shiftingWind.length === 0) return;
  throw new Error(`blowShiftingWind not implemented (${racing.length} racers, dt ${dt})`);
}
