/**
 * What happens to a drifter after it has moved through the tiles (`Medium.afterMove`): a tile that
 * stopped it sends it back the way it came with part of its speed.
 */
import type { EventSink } from '@arcade/core';
import type { GameEvent } from '../../events.ts';
import type { MoveContacts, Racer, World } from '../../types.ts';

/** Drift's `afterMove`. A stand-in that leaves the racer stopped against the tile. */
export function afterDriftMove(
  _world: World,
  _racer: Racer,
  _contacts: MoveContacts,
  _events: EventSink<GameEvent>,
): void {}
