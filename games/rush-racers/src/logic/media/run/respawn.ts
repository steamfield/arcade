/**
 * After each move: grounded state from what the runner ran into, its last safe spot, and falls out
 * through a pit. Scaffold baseline: grounded and last safe spot, and a fall puts the runner straight
 * back on its last safe spot. Phase 2 lane a adds the fallen wait, `racer.fell`, `racer.respawned`
 * and invulnerability, and owns this file.
 */
import type { EventSink } from '@arcade/core';
import type { GameEvent } from '../../events.ts';
import { type MoveContacts, type Racer, TILE, type World } from '../../types.ts';
import { runMotion } from './data.ts';

/**
 * Run's `afterMove`.
 *
 * @throws {Error} When the racer's motion isn't run's.
 */
export function afterRunMove(world: World, racer: Racer, contacts: MoveContacts, _events: EventSink<GameEvent>): void {
  const motion = runMotion(racer.motion);
  const { body } = racer;
  motion.grounded = contacts.floor;
  if (contacts.ceiling && body.vy < 0) body.vy = 0;
  if (motion.grounded) motion.lastSafe = { x: body.x, y: body.y };
  if (body.y > world.level.height * TILE) {
    body.x = motion.lastSafe.x;
    body.y = motion.lastSafe.y;
    body.vx = 0;
    body.vy = 0;
  }
}
