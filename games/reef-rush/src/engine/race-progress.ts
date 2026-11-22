/**
 * How far the player is through a race, shared by the music's tempo lift and the HUD's
 * FINAL STRETCH splash so both fire at the same moment.
 */
import { playerOf } from '../logic/racers.ts';
import type { World } from '../logic/types.ts';

/** Race progress (0..1) at which the final stretch starts. */
export const FINAL_STRETCH_AT = 0.75;

/**
 * How far the player is through the course, 0 at the start line and 1 at the finish, from the
 * progress field. `start` is the player's progress when the race was built.
 */
export function raceProgress(world: World, start: number): number {
  const player = playerOf(world);
  if (player.finished) return 1;
  if (!Number.isFinite(player.progress) || start <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - player.progress / start));
}
