/**
 * When a computer racer bursts its power-ups. `rivalIntent` asks while the racer
 * holds anything. Lane 3/b implements it and moves the item roll into
 * `rivalIntent`'s fixed draws (a fourth per tick, taken holding or not); that
 * extra draw re-orders seeded races, so scenarios that pin standings move with it.
 */
import type { Racer, Vec, World } from '../types.ts';

/**
 * True when the racer should burst this tick: its burst is ready, `roll < profile.itemAggression`,
 * and at least one held kind has a use. Uses: inkSac, a racer behind (higher progress) within 4
 * tiles; bubbleShield, a racer ahead within 6 tiles inside the aim cone; glowLantern, any racer
 * within 4 tiles; puffer, unbroken coral on the smash-field path within 3 tiles; jetFin, a clear
 * straight path of 5 tiles along the aim.
 *
 * @param aim The unit aim `rivalIntent` chose this tick.
 * @param roll The tick's item draw from the racer's rng, in [0, 1).
 */
export function wantsBurst(world: World, racer: Racer, aim: Vec, roll: number): boolean {
  void world;
  void racer;
  void aim;
  void roll;
  throw new Error('not implemented');
}
