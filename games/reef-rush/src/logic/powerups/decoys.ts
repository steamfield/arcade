/**
 * Mimic decoys: look-alikes that swim on along the steer field. Scaffold: a no-op until lane 7/a
 * gives them movement, ageing and popping. `stepWorld` calls it after projectiles and before contacts.
 */
import type { World } from '../types.ts';

/**
 * The decoys slot of `stepWorld`: moves and ages every decoy in `world.decoys`. Currently does nothing.
 *
 * @param dt Tick length in seconds.
 */
export function advanceDecoys(_world: World, _dt: number): void {}
