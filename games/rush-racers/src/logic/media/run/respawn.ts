/**
 * After each move: grounded state from what the runner ran into, a head bump, the last safe spot it
 * stood on, and falls out through a pit. A runner whose top passes below the last row emits
 * `racer.fell`, waits out `respawnTicks` parked (`status.fallen`), then reappears on its last safe
 * spot, backed off from the edge it fell from by up to `RESPAWN_RUN_UP_TILES` so it has room to jump,
 * with a short invulnerability and `racer.respawned`, through the shared timer in `../fall-out.ts`. The
 * footing rule for a safe spot is run's own.
 */
import type { EventSink } from '@arcade/core';
import type { GameEvent } from '../../events.ts';
import { blocksBody, bodyTiles, cellAt, isLedge } from '../../level/query.ts';
import { moveRulesFor } from '../../race/move.ts';
import { type Box, type Level, type MoveContacts, type Racer, TILE, type Vec, type World } from '../../types.ts';
import { fallOut, holdParked, respawnAt } from '../fall-out.ts';
import { effectiveTuning } from '../index.ts';
import { type RunMotion, runMotion } from './data.ts';
import { runExtra } from './physics.ts';

/**
 * Run's `afterMove`.
 *
 * @throws {Error} When the racer's motion isn't run's, or the world's tuning lacks run's extras.
 */
export function afterRunMove(world: World, racer: Racer, contacts: MoveContacts, events: EventSink<GameEvent>): void {
  const motion = runMotion(racer.motion);
  const extra = runExtra(effectiveTuning(world));
  if (racer.status.fallen > 0) {
    waitToRespawn(world, racer, motion, extra.respawnInvulnTicks, events);
    return;
  }
  const { body } = racer;
  motion.grounded = contacts.floor;
  if (contacts.ceiling && body.vy < 0) body.vy = 0;
  if (motion.grounded) {
    motion.airDashUsed = false;
    if (hasSafeFooting(world, body)) motion.lastSafe = { x: body.x, y: body.y };
  }
  if (body.y >= world.level.height * TILE) {
    fallOut(racer, events, extra.respawnTicks);
    motion.grounded = false;
  }
}

/**
 * True when rock or a ledge lies under both bottom corners of `body`, so a runner put back here
 * stands on it and never on the lip of a pit. Neither ever breaks. Cracked stone (coral) doesn't
 * count, since a ram or a Puffer can break it for good, and neither does a crate: its tile is open
 * in the level, solid only to `moveBody` (`moveRulesFor`).
 */
function hasSafeFooting(world: World, body: Box): boolean {
  const { left, right, bottom } = bodyTiles(body);
  const row = bottom + 1;
  return [left, right].every((column) => isFirmGround(world.level, column, row));
}

function isFirmGround(level: Level, tx: number, ty: number): boolean {
  return cellAt(level, tx, ty) === 'rock' || isLedge(level, tx, ty);
}

/**
 * One tick out of play for a fallen runner: held on its park spot, then put back on its last safe
 * spot once the fall's count runs out, with its jump timers cleared.
 */
function waitToRespawn(
  world: World,
  racer: Racer,
  motion: RunMotion,
  invulnTicks: number,
  events: EventSink<GameEvent>,
): void {
  holdParked(racer);
  racer.status.fallen -= 1;
  if (racer.status.fallen > 0) return;
  // The last safe spot is usually the pit's lip, so back off away from where the runner fell (park
  // point toward the safe spot; facing can't say, since a runner may turn in the air).
  const back = Math.sign(motion.lastSafe.x - motion.parkedAt.x);
  const spot = { x: runUpX(world, racer.body, motion.lastSafe, back), y: motion.lastSafe.y };
  respawnAt(racer, spot, invulnTicks, events);
  motion.coyote = 0;
  motion.buffer = 0;
  motion.jumping = false;
}

/** Tiles a respawn backs a runner off from the edge it fell from, ground allowing. */
export const RESPAWN_RUN_UP_TILES = 2;

/** The x furthest back from `safe` along `back`, up to RESPAWN_RUN_UP_TILES whole tiles, where a body still stands safe and clear. */
function runUpX(world: World, body: Box, safe: Vec, back: number): number {
  const rules = moveRulesFor(world);
  const clearAt = (x: number) => {
    const box = { x, y: safe.y, w: body.w, h: body.h };
    if (!hasSafeFooting(world, box)) return false;
    const { left, right, top, bottom } = bodyTiles(box);
    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) if (blocksBody(world.level, world.broken, rules, tx, ty)) return false;
    }
    return true;
  };
  let x = safe.x;
  for (let tiles = 1; tiles <= RESPAWN_RUN_UP_TILES; tiles++) {
    const next = safe.x + back * tiles * TILE;
    if (!clearAt(next)) break;
    x = next;
  }
  return x;
}
