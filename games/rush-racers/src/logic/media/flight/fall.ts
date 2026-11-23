/**
 * After each move: the last safe spot a flyer was over, and falls out of the bottom of the sky
 * through the shared timer in `../fall-out.ts`.
 *
 * Scaffold baseline: does nothing yet, so a flyer that leaves the bottom of the level stays out.
 * Phase 1 lane a records the last safe spot (rock, never coral, under both bottom corners and
 * under every column within 2 tiles) and falls out and respawns there.
 */
import type { EventSink } from '@arcade/core';
import type { GameEvent } from '../../events.ts';
import type { MoveContacts, Racer, World } from '../../types.ts';

/** Flight's `afterMove`. */
export function afterFlightMove(
  _world: World,
  _racer: Racer,
  _contacts: MoveContacts,
  _events: EventSink<GameEvent>,
): void {}
