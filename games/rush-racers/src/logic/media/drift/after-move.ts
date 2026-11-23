/**
 * What happens to a drifter after it has moved through the tiles (`Medium.afterMove`). Wiring
 * only: each rule lives in its own module.
 */
import type { EventSink } from '@arcade/core';
import type { GameEvent } from '../../events.ts';
import type { MoveContacts, Racer, World } from '../../types.ts';
import { bounceDrifter } from './bounce.ts';

/**
 * Drift's `afterMove`: a racer in play bounces off whatever stopped it. A racer that is out
 * (`status.fallen > 0`) does nothing here, so generic movement that slides it into rock while it
 * waits never reports a bounce.
 *
 * @throws {Error} When the world's tuning lacks one of drift's extras.
 */
export function afterDriftMove(world: World, racer: Racer, contacts: MoveContacts, events: EventSink<GameEvent>): void {
  if (racer.status.fallen > 0) return;
  bounceDrifter(world, racer, contacts, events);
}
