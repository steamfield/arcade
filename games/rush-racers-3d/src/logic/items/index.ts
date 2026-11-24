/**
 * Crates and items: opening crates, the inventory and its selection, firing, shots in flight,
 * Mud Pie splats, and hits. One file per item kind lives beside this one; this module is the entry
 * point `stepWorld` calls.
 */
import type { Rng } from '@arcade/core';
import type { ItemKind, TickInputs, World } from '../types.ts';

/**
 * Runs one tick of items for every racer after racers have moved and before bumps: crates touched,
 * selection changes and fire presses from `inputs` (rivals' come from the AI), shots moved and
 * resolved, splats aged, hits applied. Randomness comes only from `world.rngState`.
 */
export function stepItems(world: World, inputs: TickInputs): void {
  void world;
  void inputs;
  throw new Error('stepItems: not implemented (phase 3 lane a)');
}

/** The item a crate gives a racer in `place` (1-based), weighted so leaders get defence and trailers get speed. */
export function rollItem(rng: Rng, place: number): ItemKind {
  void rng;
  void place;
  throw new Error('rollItem: not implemented (phase 3 lane a)');
}
