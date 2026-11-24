/**
 * Whirlpools, Reef's set piece: swirls of water that push racers inside them round their centres
 * (`LevelDef.whirlpools`). Reading them from the course and the push they give live here.
 */
import type { Cell, Racer, WhirlpoolDef, World } from '../types.ts';

/** Whirlpool numbers: the lane that builds them fills this in. */
export const WHIRLPOOL = {} as const;

/**
 * Checks a level's whirlpools against its cells and returns them in the order written.
 *
 * @throws {LevelError} For a centre off the map or not open water, a radius outside 2-10, a push that
 *   isn't positive, a spin other than 1 or -1, or two pools whose discs overlap.
 */
export function parseWhirlpools(defs: readonly WhirlpoolDef[], cells: readonly (readonly Cell[])[]): WhirlpoolDef[] {
  if (defs.length === 0) return [];
  throw new Error(`parseWhirlpools not implemented (${cells.length} rows)`);
}

/** The whirlpools slot of `stepRace`: pushes each racer inside a pool round it; emits `whirlpool.caught`. */
export function swirlWhirlpools(world: World, racing: readonly Racer[], dt: number): void {
  if (world.level.whirlpools.length === 0) return;
  throw new Error(`swirlWhirlpools not implemented (${racing.length} racers, ${dt})`);
}
