/**
 * What an online race adds to the race screen, as plain data: a lobby label (P1 to P4) over each
 * racer a person still drives, and a line naming the players the race is waiting on once it has
 * stalled long enough to notice. The race scene draws them; offline there is neither.
 */
import { activeHumans } from '../../logic/racers.ts';
import type { RacerId, World } from '../../logic/types.ts';
import type { RaceView } from '../../net/client.ts';

/** How long the local race must have stood still before the waiting line shows. */
export const WAITING_AFTER_MS = 500;

/** A label to draw over a racer. */
export interface RacerTag {
  id: RacerId;
  label: string;
}

/**
 * The tag over each racer a person still drives in `world`, the local one included, from the
 * race's lobby labels. A racer the AI took over (its player left) has none.
 */
export function racerTags(world: World, race: Pick<RaceView, 'labels'>): RacerTag[] {
  return activeHumans(world).flatMap((racer) => {
    const label = race.labels[racer.id];
    return label === undefined ? [] : [{ id: racer.id, label }];
  });
}

/**
 * "WAITING FOR P2" (every label the race waits on, space-separated, at most 20 characters for
 * three) once the race has stalled `WAITING_AFTER_MS` or more on someone; null otherwise.
 */
export function waitingLine(race: Pick<RaceView, 'stalledMs' | 'waitingOn'>): string | null {
  if (race.stalledMs < WAITING_AFTER_MS || race.waitingOn.length === 0) return null;
  return `WAITING FOR ${race.waitingOn.join(' ')}`;
}
