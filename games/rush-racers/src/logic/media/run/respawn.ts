/**
 * After each move: grounded state from what the runner ran into, a head bump, the last safe spot it
 * stood on, and falls out through a pit. A runner whose top passes below the last row emits
 * `racer.fell`, waits out `respawnTicks` parked (`status.fallen`), then reappears on its last safe
 * spot with a short invulnerability and `racer.respawned`.
 */
import type { EventSink } from '@arcade/core';
import type { GameEvent } from '../../events.ts';
import { bodyTiles, cellAt, isLedge } from '../../level/query.ts';
import { type Box, type Level, type MoveContacts, type Racer, TILE, type World } from '../../types.ts';
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
    holdParked(racer, motion);
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
 * Puts a fallen runner back on its park point at rest. Generic movement after `applyIntent` (a
 * running dash item, an undertow, a latch drift) would otherwise slide the parked body.
 */
function holdParked(racer: Racer, motion: RunMotion): void {
  racer.body.x = motion.parkedAt.x;
  racer.body.y = motion.parkedAt.y;
  racer.body.vx = 0;
  racer.body.vy = 0;
}

/** Starts a fall: the runner stops where it is, out of the level, until `afterRunMove` counts it back. */
function fallOut(racer: Racer, motion: RunMotion, respawnTicks: number, events: EventSink<GameEvent>): void {
  racer.body.vx = 0;
  racer.body.vy = 0;
  racer.status.fallen = respawnTicks;
  motion.parkedAt = { x: racer.body.x, y: racer.body.y };
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
