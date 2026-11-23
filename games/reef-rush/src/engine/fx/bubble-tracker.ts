/**
 * Finds where bubbles burst. `bubble.popped` doesn't say where (a bubble that hits a wall or
 * runs out of time has no racer to point at), so this remembers every bubble in flight at the
 * end of each tick and, on a tick with pops, reports the ones that are no longer there at the
 * spot they would have reached. Storage is fixed-size typed arrays, so a tick allocates nothing.
 */
import { TICK_HZ } from '@arcade/core';
import type { RacerId, World } from '../../logic/types.ts';

/** Remembers bubbles between ticks to locate the ones that burst. */
export interface BubbleTracker {
  /** Calls `visit` with the position of each bubble remembered last tick that has gone from `world`. */
  vanished(world: World, visit: (x: number, y: number) => void): void;
  /** Remembers the bubbles in flight now, for the next tick's `vanished`. */
  remember(world: World): void;
}

/** More bubbles than this in flight at once are not tracked; four racers rarely have more than four. */
const CAPACITY = 16;
/** A bubble this close (px) to where a remembered one should be now, with the same owner, is that bubble. */
const SAME_BUBBLE_PX = 4;

/** Creates a tracker that remembers no bubbles yet. */
export function createBubbleTracker(): BubbleTracker {
  const xs = new Float64Array(CAPACITY);
  const ys = new Float64Array(CAPACITY);
  const owners: (RacerId | null)[] = new Array(CAPACITY).fill(null);
  let count = 0;

  const stillFlying = (world: World, x: number, y: number, owner: RacerId | null) =>
    world.bubbles.some((bubble) => bubble.owner === owner && Math.hypot(bubble.x - x, bubble.y - y) <= SAME_BUBBLE_PX);

  return {
    vanished(world, visit) {
      for (let index = 0; index < count; index++) {
        const x = xs[index] ?? 0;
        const y = ys[index] ?? 0;
        if (!stillFlying(world, x, y, owners[index] ?? null)) visit(x, y);
      }
    },
    remember(world) {
      count = Math.min(world.bubbles.length, CAPACITY);
      for (let index = 0; index < count; index++) {
        const bubble = world.bubbles[index];
        if (!bubble) continue;
        // Stored where it will be next tick, so a bubble that lives on matches its new position.
        xs[index] = bubble.x + bubble.vx / TICK_HZ;
        ys[index] = bubble.y + bubble.vy / TICK_HZ;
        owners[index] = bubble.owner;
      }
    },
  };
}
