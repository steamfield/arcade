/**
 * Which racer the AI rivals measure their catch-up against.
 */
import { playerOf } from '../racers.ts';
import type { Racer, World } from '../types.ts';

/**
 * The human the rivals pace themselves to: among human slots, the unfinished one with the least
 * progress left (ties to the earlier slot), or the best finisher once every human slot is home.
 */
export function catchUpTarget(world: World): Racer {
  return playerOf(world);
}
