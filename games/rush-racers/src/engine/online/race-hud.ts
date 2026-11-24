/**
 * What an online race adds to the race screen, as plain data: a lobby label (P1 to P4) over each
 * racer a person still drives, and a line naming the players the race is waiting on once it has
 * stalled long enough to notice, plus which side of its racer a tag sits so it never covers the
 * HUD. The race scene draws them; offline there is neither.
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
 * "WAITING FOR P2" (every label the race waits on, space-separated) once the race has stalled
 * `WAITING_AFTER_MS` or more on someone; null otherwise. Three labels go on a second line, since
 * one line of them is 121 px with its outline and the safe column is 120.
 */
export function waitingLine(race: Pick<RaceView, 'stalledMs' | 'waitingOn'>): string | null {
  if (race.stalledMs < WAITING_AFTER_MS || race.waitingOn.length === 0) return null;
  const breakBefore = race.waitingOn.length > 2 ? '\n' : ' ';
  return `WAITING FOR${breakBefore}${race.waitingOn.join(' ')}`;
}

/** The HUD's rows end above this screen y: the place change arrow's bottom is 43 (UI.md "Race HUD"). */
export const HUD_ROWS_BOTTOM = 44;
/** A tag's gap from its racer's sprite, and its height: one line of the text face. */
const TAG_GAP = 2;
const TAG_HEIGHT = 7;
/** The outline drawn round a tag's glyphs. */
const OUTLINE = 1;

/** A racer's sprite on screen: its top and bottom edges in screen px (bottom exclusive). */
export interface SpriteRows {
  top: number;
  bottom: number;
}

/**
 * The screen y of a tag's glyph top: 2 px above its racer's sprite, or 2 px below it where above
 * would put any of it, outline included, over the HUD's rows. Null when below would too, so the
 * tag hides rather than cover a well.
 */
export function tagTop(sprite: SpriteRows): number | null {
  const above = sprite.top - TAG_GAP - TAG_HEIGHT;
  if (above - OUTLINE >= HUD_ROWS_BOTTOM) return above;
  const below = sprite.bottom + TAG_GAP;
  return below - OUTLINE >= HUD_ROWS_BOTTOM ? below : null;
}
