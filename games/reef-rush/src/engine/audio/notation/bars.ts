/**
 * Bar assembly: walks a channel line's tokens, keeps each channel's bar and beat position,
 * checks every bar fills the time signature, and lines channels up at section ends.
 */
import type { Channel } from '../notation.ts';
import { failAt, type Place } from './errors.ts';
import { type ChannelEvents, placeNote } from './events.ts';
import { parseNoteToken, tokenizeLine } from './tokens.ts';

/** One channel's write head while parsing. */
export interface Track extends ChannelEvents {
  /** Bars completed so far. */
  bar: number;
  /** Beats written into the open bar. */
  barBeats: number;
  playedInSection: boolean;
}

/** A track at the start of the song. */
export function createTrack(channel: Channel): Track {
  return { channel, bar: 0, barBeats: 0, events: [], tie: null, playedInSection: false };
}

/**
 * Writes one channel line. `|` and the end of the line close a bar.
 *
 * @throws {Error} Naming the channel, bar and token when a token is malformed, a note runs past
 *   the bar line, or a bar holds other than `beatsPerBar` beats.
 */
export function writeChannelLine(track: Track, value: string, line: number, beatsPerBar: number): void {
  track.playedInSection = true;
  let place: Place | null = null;
  for (const token of tokenizeLine(value, { channel: track.channel, bar: track.bar, line, token: '' })) {
    place = { channel: track.channel, bar: track.bar, line, token };
    if (token === '|') closeBar(track, place, beatsPerBar);
    else writeNote(track, place, beatsPerBar);
  }
  if (place && track.barBeats > 0) closeBar(track, place, beatsPerBar);
}

function closeBar(track: Track, place: Place, beatsPerBar: number): void {
  if (track.barBeats !== beatsPerBar) {
    failAt(place, `bar holds ${track.barBeats} beats but the time signature needs ${beatsPerBar}`);
  }
  track.bar += 1;
  track.barBeats = 0;
}

function writeNote(track: Track, place: Place, beatsPerBar: number): void {
  const note = parseNoteToken(place);
  const filled = track.barBeats + note.beats;
  if (filled > beatsPerBar)
    failAt(place, `runs past the bar line: the bar would hold ${filled} of ${beatsPerBar} beats`);
  placeNote(track, note, track.bar * beatsPerBar + track.barBeats, place);
  track.barBeats = filled;
}

/**
 * Lines every track up at the end of a section and returns the bar the next one starts at.
 * Tracks with no lines in the section rest up to that bar.
 *
 * @throws {Error} When playing tracks have different bar counts, naming the section, or when a
 *   silent track has a tie pending into its rest.
 */
export function closeSection(tracks: readonly Track[], sectionName: string | undefined): number {
  const longest = tracks.reduce((a, b) => (b.bar > a.bar ? b : a));
  const where = sectionName === undefined ? 'before the first section' : `in section "${sectionName}"`;
  for (const track of tracks) {
    if (track.playedInSection && track.bar !== longest.bar) {
      throw new Error(
        `${track.channel} bar ${track.bar + 1}: ${track.channel} has ${track.bar} bars but ${longest.channel} has ` +
          `${longest.bar} ${where}; every playing channel needs the same number of bars`,
      );
    }
    if (track.bar < longest.bar && track.tie) failAt(track.tie.place, 'tie runs into a rest');
    track.bar = longest.bar;
    track.playedInSection = false;
  }
  return longest.bar;
}
