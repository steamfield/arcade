/**
 * Wormholes, Farside's set piece: paired mouths that carry a racer from one to the other with its
 * velocity kept (`LevelDef.wormholes`). Cooldowns live in `World.warps`.
 */
import type { Cell, Racer, World, WormholeDef } from '../types.ts';

/** Wormhole numbers: the lane that builds them fills this in. */
export const WORMHOLE = {} as const;

/**
 * Checks a level's wormholes against its cells and returns them in the order written.
 *
 * @throws {LevelError} For a mouth off the map or not on an open tile, a hole's mouths under 4 tiles
 *   apart, or mouths of different holes under 3 tiles apart.
 */
export function parseWormholes(defs: readonly WormholeDef[], cells: readonly (readonly Cell[])[]): WormholeDef[] {
  if (defs.length === 0) return [];
  throw new Error(`parseWormholes not implemented (${cells.length} rows)`);
}

/** The wormholes slot of `stepRace`: warps racers that enter a mouth; emits `wormhole.warped`. */
export function warpWormholes(world: World, racing: readonly Racer[]): void {
  if (world.level.wormholes.length === 0) return;
  throw new Error(`warpWormholes not implemented (${racing.length} racers)`);
}
