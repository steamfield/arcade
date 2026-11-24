/**
 * Riding a spring mushroom (a bounce cell, `B`). `race/bounce.ts` launches a runner that lands on
 * one at RUN_BOUNCE_SPEED right after its move, so on the next tick `applyRunIntent` finds it still
 * grounded but already rising at least that fast. This file tells that tick apart from standing on
 * ground and decides how the launch goes: Up held raises it, and nothing a jump does can lower it.
 * It also finds the mushroom under a runner's feet, for the pilot to follow its bounce.
 */
import { bodyTiles, cellAt } from '../../level/query.ts';
import { type Body, type Box, type Level, TILE } from '../../types.ts';
import type { RunMotion } from './data.ts';
import { RUN_BOUNCE_SPEED, RUN_HELD_BOUNCE_SPEED } from './tuning.ts';

/** True when a mushroom sprang the runner at the end of last tick: it stood on it, and now rises at the spring's speed. */
export function isSprung(grounded: boolean, body: Pick<Body, 'vy'>): boolean {
  return grounded && body.vy <= -RUN_BOUNCE_SPEED;
}

/**
 * Takes the launch the spring gave. With Up held it rises at RUN_HELD_BOUNCE_SPEED instead. No jump
 * stays buffered or in coyote time, since a jump fired in the next few ticks would set the lower
 * jump speed in place of the spring's; and the launch is no jump (`jumping` false), so letting go of
 * Up never cuts it short.
 */
export function rideSpring(body: Pick<Body, 'vy'>, motion: RunMotion, upHeld: boolean): void {
  if (upHeld) body.vy = Math.min(body.vy, -RUN_HELD_BOUNCE_SPEED);
  motion.buffer = 0;
  motion.coyote = 0;
  motion.jumping = false;
}

/**
 * The stand tile index (`y * width + x`) on top of a spring mushroom under `body`'s feet, or null.
 * It reads the same tiles `race/bounce.ts` launches from, so a sliver of a corner over one counts,
 * often while the runner's middle is still over the tile before; the pilot then follows the bounce
 * planned on the mushroom's tile rather than the tile it is leaving.
 */
export function springUnderFeet(level: Level, body: Box): number | null {
  const { left, right } = bodyTiles(body);
  const rowBelow = Math.floor((body.y + body.h) / TILE);
  for (const col of [left, right]) {
    if (cellAt(level, col, rowBelow) === 'bounce') return (rowBelow - 1) * level.width + col;
  }
  return null;
}
