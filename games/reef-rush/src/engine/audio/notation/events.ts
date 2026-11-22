/**
 * Turns parsed tokens into NoteEvents at a beat position: rests leave gaps, ties extend the
 * note they started from, and the finished channels merge into one time-ordered list.
 */
import type { Channel, NoteEvent } from '../notation.ts';
import { failAt, type Place } from './errors.ts';
import type { ParsedToken } from './tokens.ts';

/** A channel's emitted notes and the tie, if any, still waiting for its continuation. */
export interface ChannelEvents {
  channel: Channel;
  events: NoteEvent[];
  /** The note a `~` is extending, with the token that opened the tie. */
  tie: { event: NoteEvent; place: Place } | null;
}

/**
 * Places one token at `start` beats. A tied note keeps the first note's velocity, slide and
 * vibrato; later notes in the tie only add length.
 *
 * @throws {Error} When a tie continues on a different pitch or into a rest.
 */
export function placeNote(target: ChannelEvents, note: ParsedToken, start: number, place: Place): void {
  const tie = target.tie;
  if (tie) {
    if (note.pitch !== tie.event.pitch)
      failAt(place, `the tie from "${tie.place.token}" must continue on the same pitch`);
    tie.event.length += note.beats;
    if (!note.tie) target.tie = null;
    return;
  }
  if (note.pitch === null) return;
  const event: NoteEvent = {
    channel: target.channel,
    start,
    length: note.beats,
    pitch: note.pitch,
    velocity: note.velocity,
  };
  if (note.slide !== undefined) event.slideTo = note.slide;
  if (note.vibrato) event.vibrato = true;
  target.events.push(event);
  if (note.tie) target.tie = { event, place };
}

/**
 * Merges every channel's notes into one list ordered by start, channels in the given order on ties.
 *
 * @throws {Error} Naming the opening token when a tie runs past the end of the song.
 */
export function collectNotes(channels: readonly ChannelEvents[]): NoteEvent[] {
  for (const { tie } of channels) {
    if (tie) failAt(tie.place, 'tie runs past the end of the song');
  }
  return channels.flatMap((channel) => channel.events).sort((a, b) => a.start - b.start);
}
