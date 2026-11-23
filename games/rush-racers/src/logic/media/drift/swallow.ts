/**
 * Black holes: a drifter whose centre is inside a horizon is swallowed, waits out of play, and
 * comes back at rest on the last spot where it flew free of every hole's reach, through the shared
 * timer in `../fall-out.ts`.
 */
import type { EventSink } from '@arcade/core';
import type { GameEvent } from '../../events.ts';
import type { Racer, World } from '../../types.ts';

/**
 * One tick of the black hole rule for `racer`, after it has moved: a racer that is out waits and,
 * when its wait ends, respawns; a racer in play has its last free spot kept up to date and is
 * swallowed if its centre is inside a horizon.
 */
export function swallowOrRespawn(_world: World, _racer: Racer, _events: EventSink<GameEvent>): void {}
