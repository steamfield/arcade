/**
 * After each move: the last safe spot a flyer was over, and falls out of the bottom of the sky
 * through the shared timer in `../fall-out.ts`. A flyer whose top passes below the last row emits
 * `racer.fell`, waits out `respawnTicks` parked (`status.fallen`), then reappears on its last safe
 * spot at rest with a short invulnerability and `racer.respawned`.
 *
 * A safe spot has rock somewhere below it in the flyer's own columns and in every column within
 * `SAFE_MARGIN_TILES` either side, so a flyer put back there with no input falls onto rock and never
 * drifts off the lip into the gap it fell through. Puff clouds (coral) don't count: a dash can pop
 * them for good. Nor does a spot in a sideways gust (`<` `>`): an idle flyer put back there would
 * drift along it as it falls, possibly into the gap.
 */
import type { EventSink } from '@arcade/core';
import type { GameEvent } from '../../events.ts';
import { bodyTiles, cellAt } from '../../level/query.ts';
import { type Box, type Level, type MoveContacts, type Racer, TILE, type World } from '../../types.ts';
import { fallOut, holdParked, respawnAt } from '../fall-out.ts';
import { effectiveTuning } from '../index.ts';
import { type FlightMotion, flightMotion } from './data.ts';
import { flightExtra } from './physics.ts';

/** Columns either side of a flyer that must also have rock below for its spot to count as safe. */
const SAFE_MARGIN_TILES = 2;

/**
 * Flight's `afterMove`.
 *
 * @throws {Error} When the racer's motion isn't flight's, or the world's tuning lacks flight's extras.
 */
export function afterFlightMove(
  world: World,
  racer: Racer,
  _contacts: MoveContacts,
  events: EventSink<GameEvent>,
): void {
  const motion = flightMotion(racer.motion);
  const extra = flightExtra(effectiveTuning(world));
  if (racer.status.fallen > 0) {
    waitToRespawn(racer, motion, extra.respawnInvulnTicks, events);
    return;
  }
  const { body } = racer;
  if (isSafeSpot(world.level, body)) motion.lastSafe = { x: body.x, y: body.y };
  if (body.y >= world.level.height * TILE) fallOut(racer, events, extra.respawnTicks);
}

/**
 * True when `body` is out of any sideways gust and every column from `SAFE_MARGIN_TILES` left of it
 * to as far right of it has rock below it.
 */
function isSafeSpot(level: Level, body: Box): boolean {
  if (inSidewaysGust(level, body)) return false;
  const { left, right, bottom } = bodyTiles(body);
  for (let column = left - SAFE_MARGIN_TILES; column <= right + SAFE_MARGIN_TILES; column++) {
    if (!hasRockBelow(level, column, bottom + 1)) return false;
  }
  return true;
}

/** True when `body` overlaps a gust cell (`<` or `>`), which pushes a flyer sideways. */
function inSidewaysGust(level: Level, body: Box): boolean {
  const { left, right, top, bottom } = bodyTiles(body);
  for (let row = top; row <= bottom; row++) {
    for (let column = left; column <= right; column++) {
      const cell = cellAt(level, column, row);
      if (cell === 'current-left' || cell === 'current-right') return true;
    }
  }
  return false;
}

/**
 * True when a rock cell lies in `column` at or below `fromRow`, inside the level. Outside the grid's
 * sides counts as rock (`cellAt`), as the level's edge is a wall; below its last row is open sky.
 */
function hasRockBelow(level: Level, column: number, fromRow: number): boolean {
  for (let row = fromRow; row < level.height; row++) {
    if (cellAt(level, column, row) === 'rock') return true;
  }
  return false;
}

/**
 * One tick out of play for a fallen flyer: held on its park spot, then put back on its last safe
 * spot once the fall's count runs out, with the flap cooldown cleared, no dive and no dash window.
 */
function waitToRespawn(racer: Racer, motion: FlightMotion, invulnTicks: number, events: EventSink<GameEvent>): void {
  holdParked(racer);
  racer.status.fallen -= 1;
  if (racer.status.fallen > 0) return;
  respawnAt(racer, motion.lastSafe, invulnTicks, events);
  // A fallen racer's input reaches the medium as nothing (`controlledIntent`), so whether Up is held
  // through the wait is unknown: count it as held, and a flap back in play needs a fresh press.
  motion.upWasHeld = true;
  motion.flapCooldown = 0;
  motion.diving = false;
  motion.dashWindow = 0;
}
