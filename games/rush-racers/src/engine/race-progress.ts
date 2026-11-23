/**
 * How far the local racer (the slot the screen follows) is through a race, shared by the music's tempo lift and the HUD's
 * FINAL STRETCH splash so both fire at the same moment. Also where the progress strip puts
 * racers' heads when they bunch, so the heads never hide each other.
 */
import type { World } from '../logic/types.ts';
import { localOf } from './local-racer.ts';

/** Race progress (0..1) at which the final stretch starts. */
export const FINAL_STRETCH_AT = 0.75;

/**
 * How far the local racer is through the course, 0 at the start line and 1 at the finish, from the
 * progress field. `start` is its progress when the race was built.
 */
export function raceProgress(world: World, start: number): number {
  const racer = localOf(world);
  if (racer.finished) return 1;
  if (!Number.isFinite(racer.progress) || start <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - racer.progress / start));
}

/**
 * Spreads progress-strip heads so no two sit closer than `minGap` px, keeping the head at `anchor`
 * (the local racer's) exactly where it is unless the strip's ends force it to move. `xs` are each head's
 * true x; the result is each head's drawn x, in the same order, all within `lo..hi`. Heads that
 * share a spot fan out away from the anchor: to its right near the start, to its left near the end,
 * so a pack at the finish line does not run off the strip.
 */
export function spreadHeads(xs: readonly number[], anchor: number, minGap: number, lo: number, hi: number): number[] {
  const middle = (lo + hi) / 2;
  const order = xs.map((_, index) => index).sort((a, b) => compareHeads(xs, anchor, middle, a, b));
  const placed = order.map((index) => xs[index] ?? lo);
  const anchorAt = order.indexOf(anchor);
  // Right of the anchor, then left of it, each pushed just far enough from its neighbour nearer the anchor.
  for (let at = anchorAt + 1; at < placed.length; at++)
    placed[at] = Math.max(placed[at] ?? 0, (placed[at - 1] ?? 0) + minGap);
  for (let at = anchorAt - 1; at >= 0; at--) placed[at] = Math.min(placed[at] ?? 0, (placed[at + 1] ?? 0) - minGap);
  // The strip's ends win: pull the whole line back inside, which can move the anchor.
  for (let at = placed.length - 1; at >= 0; at--)
    placed[at] = Math.min(placed[at] ?? 0, hi - (placed.length - 1 - at) * minGap);
  for (let at = 0; at < placed.length; at++) placed[at] = Math.max(placed[at] ?? 0, lo + at * minGap);
  const drawn = xs.map(() => lo);
  order.forEach((index, at) => {
    drawn[index] = placed[at] ?? lo;
  });
  return drawn;
}

/** Left to right by x; among heads on the same spot, the anchor goes first in the first half of the strip and last in the second. */
function compareHeads(xs: readonly number[], anchor: number, middle: number, a: number, b: number): number {
  const byX = (xs[a] ?? 0) - (xs[b] ?? 0);
  if (byX !== 0) return byX;
  if (a === anchor || b === anchor) {
    const anchorFirst = (xs[a] ?? 0) <= middle;
    const anchorIsA = a === anchor;
    return anchorIsA === anchorFirst ? -1 : 1;
  }
  return a - b;
}
