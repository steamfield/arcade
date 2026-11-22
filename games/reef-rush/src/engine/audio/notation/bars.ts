/**
 * Bar assembly: walks a channel line's tokens, keeps each channel's bar and beat position,
 * checks every bar fills the time signature, and lines channels up at section ends.
 */
import { failAt } from './errors.ts';
import { type ChannelEvents, placeNote } from './events.ts';
import { parseNoteToken, tokenizeLine } from './tokens.ts';
import type { Channel, Place } from './types.ts';

/** One channel's write head while parsing. */
export interface Track extends ChannelEvents {
  /** Bars completed so far. */
  bar: number;
  /** Beats written into the open bar. */
  barBeats: number;
  /** The bar the current section started at. */
  sectionStartBar: number;
  playedInSection: boolean;
  /** The last source line this track wrote, for section errors. */
  lastLine: number;
}

/** A track at the start of the song. */
export function createTrack(channel: Channel): Track {
  return {
    channel,
    bar: 0,
    barBeats: 0,
    sectionStartBar: 0,
    events: [],
    tie: null,
    playedInSection: false,
    lastLine: 0,
  };
}

/**
 * Writes one channel line. `|` and the end of the line close a bar.
 *
 * @throws {Error} Naming the channel, bar and token when a token is malformed, a note runs past
 *   the bar line, or a bar holds other than `beatsPerBar` beats.
 */
export function writeChannelLine(track: Track, value: string, line: number, beatsPerBar: number): void {
  track.playedInSection = true;
  track.lastLine = line;
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
 * @throws {Error} When a named section has no bars, when playing tracks have different bar
 *   counts within the section, or when a silent track has a tie pending into its rest.
 */
export function closeSection(tracks: readonly Track[], sectionName: string | undefined): number {
  const start = tracks[0]?.sectionStartBar ?? 0;
  const longest = tracks.reduce((a, b) => (b.bar > a.bar ? b : a));
  const where = sectionName === undefined ? 'the part before the first section' : `section "${sectionName}"`;
  if (sectionName !== undefined && longest.bar === start) {
    throw new Error(`${where} has no bars; give it a channel line or remove it`);
  }
  for (const track of tracks) {
    if (track.playedInSection && track.bar !== longest.bar) {
      throw new Error(
        `${track.channel} bar ${track.bar + 1} (line ${track.lastLine}): ${where} has ${barCount(track.bar - start)} ` +
          `on ${track.channel} but ${longest.bar - start} on ${longest.channel}; every playing channel needs the same number of bars`,
      );
    }
    if (track.bar < longest.bar && track.tie) {
      failAt(track.tie.place, `a tie can't continue into a rest; ${track.channel} is silent in ${where}`);
    }
    track.bar = longest.bar;
    track.sectionStartBar = longest.bar;
    track.playedInSection = false;
  }
  return longest.bar;
}

function barCount(bars: number): string {
  return bars === 1 ? '1 bar' : `${bars} bars`;
}
