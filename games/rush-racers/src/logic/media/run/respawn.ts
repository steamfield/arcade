/**
 * After each move: grounded state from what the runner ran into, a head bump, the last safe spot it
 * stood on, and falls out through a pit. A runner whose top passes below the last row emits
 * `racer.fell`, waits out `respawnTicks` parked (`status.fallen`), then reappears on its last safe
 * spot with a short invulnerability and `racer.respawned`.
 */
import type { EventSink } from '@arcade/core';
import type { GameEvent } from '../../events.ts';
import { bodyTiles, isLedge, isSolid } from '../../level/query.ts';
import { type Box, type MoveContacts, type Racer, TILE, type World } from '../../types.ts';
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
    racer.status.fallen -= 1;
    if (racer.status.fallen === 0) respawn(racer, motion, extra.respawnInvulnTicks, events);
    return;
  }
  const { body } = racer;
  motion.grounded = contacts.floor;
  if (contacts.ceiling && body.vy < 0) body.vy = 0;
  if (motion.grounded) {
    motion.airDashUsed = false;
    if (hasSafeFooting(world, body)) motion.lastSafe = { x: body.x, y: body.y };
  }
  if (body.y >= world.level.height * TILE) fallOut(racer, motion, extra.respawnTicks, events);
}

/**
 * True when solid ground or a ledge lies under both bottom corners of `body`, so a runner put back
 * here stands on it and never on the lip of a pit. A crate doesn't count: its tile is open water in
 * the level, solid only to `moveBody` (`moveRulesFor`), so a runner never respawns on one it might open.
 */
function hasSafeFooting(world: World, body: Box): boolean {
  const { left, right, bottom } = bodyTiles(body);
  const row = bottom + 1;
  return [left, right].every(
    (column) => isSolid(world.level, world.broken, column, row) || isLedge(world.level, column, row),
  );
}

/** Starts a fall: the runner stops where it is, out of the level, until `afterRunMove` counts it back. */
function fallOut(racer: Racer, motion: RunMotion, respawnTicks: number, events: EventSink<GameEvent>): void {
  racer.body.vx = 0;
  racer.body.vy = 0;
  racer.status.fallen = respawnTicks;
  motion.grounded = false;
  events.emit({ type: 'racer.fell', id: racer.id });
}

/** Puts a fallen runner back on its last safe spot at rest, briefly invulnerable. */
function respawn(racer: Racer, motion: RunMotion, invulnTicks: number, events: EventSink<GameEvent>): void {
  const { body } = racer;
  body.x = motion.lastSafe.x;
  body.y = motion.lastSafe.y;
  body.vx = 0;
  body.vy = 0;
  motion.coyote = 0;
  motion.buffer = 0;
  motion.jumping = false;
  racer.status.invulnerable = invulnTicks;
  events.emit({ type: 'racer.respawned', id: racer.id, x: body.x, y: body.y });
}
