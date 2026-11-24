/**
 * Geyser vents, Sunlit Shallows' set piece: each vent warns, then erupts on a timer that is a pure
 * function of the race tick, pushing racers in its column upward (`LevelDef.vents`).
 */
import type { Racer, VentDef, World } from '../types.ts';

/**
 * Checks a level's vents and returns them in the order written.
 *
 * @throws {LevelError} For a vent off the map, a height or period that isn't positive, or two vents sharing a column.
 */
export function parseVents(defs: readonly VentDef[], width: number, height: number): VentDef[] {
  if (defs.length === 0) return [];
  throw new Error(`parseVents not implemented (${width}x${height})`);
}

/** The vents slot of `stepRace`: emits each vent's warning and eruption and pushes the racers it reaches. */
export function eruptVents(world: World, racing: readonly Racer[], dt: number): void {
  if (world.level.vents.length === 0) return;
  throw new Error(`eruptVents not implemented (${racing.length} racers, dt ${dt})`);
}
