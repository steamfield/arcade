/**
 * Crumbling branches, Thornwood's set piece: ledge runs that shake when a racer stands on them, fall
 * away, and grow back (`LevelDef.crumbles`). The only writer of `World.fallen`.
 */
import type { Cell, CrumbleDef, CrumbleState, Level, Racer, World } from '../types.ts';

/** Crumbling branch numbers: the lane that builds them fills this in. */
export const CRUMBLE = {} as const;

/**
 * Checks a level's crumbling branches against its cells and returns them in the order written.
 *
 * @throws {LevelError} For a run off the map, a tile in it that isn't a ledge, a length outside 1-12,
 *   or two runs sharing a tile.
 */
export function parseCrumbles(defs: readonly CrumbleDef[], cells: readonly (readonly Cell[])[]): CrumbleDef[] {
  if (defs.length === 0) return [];
  throw new Error(`parseCrumbles not implemented (${cells.length} rows)`);
}

/** Every branch of `level` solid, as a race starts. */
export function createCrumbles(level: Level): CrumbleState[] {
  return level.crumbles.map(() => ({ phase: 'solid', ticks: 0 }));
}

/** The crumbling branches slot of `stepRace`: shakes, drops and regrows branches; emits `crumble.*`. */
export function crumbleBranches(world: World, racing: readonly Racer[]): void {
  if (world.level.crumbles.length === 0) return;
  throw new Error(`crumbleBranches not implemented (${racing.length} racers)`);
}
