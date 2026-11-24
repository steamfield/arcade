/**
 * The sound test as plain state and moves: the soundtrack's track list, the cursor, which song is
 * playing and which of its sections is sounding, and what each press does. The runtime feeds it a
 * press every tick and acts on the outcome (audition a song, stop, leave); the scene only draws it.
 */
import { SONG_ENDED } from '../audio/music-cues.ts';
import type { Song } from '../audio/notation.ts';
import { RACE_TRACKS, type SongName, type SongSet, songs } from '../audio/songs/index.ts';

/** One song on the list, with the race set it belongs to, or null for the menu songs and jingles. */
export interface JukeboxTrack {
  name: SongName;
  song: Song;
  set: SongSet | null;
}

/** The sound test's state. `pressJukebox` and `hearJukebox` change it in place. */
export interface Jukebox {
  readonly tracks: readonly JukeboxTrack[];
  /** Index into `tracks` of the highlighted song. */
  cursor: number;
  /** The song auditioned last, or null while nothing plays. */
  playing: SongName | null;
  /** The playing song's section sounding now, or null when it is not known (or nothing plays). */
  section: string | null;
  /** Ticks left before fire is taken, so a fire still held from the screen before can't start a song unseen. */
  armIn: number;
}

/** The buttons the sound test takes. */
export type JukeboxPress = 'up' | 'down' | 'left' | 'right' | 'fire' | 'dash';

/** What a press asks the runtime to do: nothing, play a song (from a section), stop the music, or leave to the title. */
export type JukeboxOutcome =
  | { kind: 'stay' }
  | { kind: 'play'; song: SongName; section?: string }
  | { kind: 'stop' }
  | { kind: 'leave' };

/** One line of the drawn list: a set's heading, or a track by its index in `Jukebox.tracks`. */
export type JukeboxLine = { kind: 'heading'; text: string } | { kind: 'track'; index: number };

/** Ticks the screen ignores fire after it appears, as menus do. */
export const JUKEBOX_ARM_TICKS = 20;

/** The heading over the songs that belong to no race set. */
const OTHER_HEADING = 'OTHER SONGS';

/** Sharps only: the pixel font draws a lowercase b as a capital, so flats would read as B. */
const PITCH_CLASS_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const STAY: JukeboxOutcome = { kind: 'stay' };

/** Every song in the soundtrack: each race set's tracks in `RACE_TRACKS` order, then the songs no set lists. */
export function soundtrackTracks(): JukeboxTrack[] {
  const sets = Object.entries(RACE_TRACKS) as [SongSet, readonly SongName[]][];
  const raceTracks = sets.flatMap(([set, names]) => names.map((name) => ({ name, song: songs[name], set })));
  const listed = new Set<SongName>(raceTracks.map((track) => track.name));
  const others = (Object.keys(songs) as SongName[])
    .filter((name) => !listed.has(name))
    .map((name) => ({ name, song: songs[name], set: null }));
  return [...raceTracks, ...others];
}

/** A sound test over `tracks` with the cursor on the first, nothing playing and fire not yet armed. */
export function createJukebox(tracks: readonly JukeboxTrack[]): Jukebox {
  return { tracks, cursor: 0, playing: null, section: null, armIn: JUKEBOX_ARM_TICKS };
}

/**
 * Takes one tick's press (null when none) and says what the runtime should do. Call it every tick
 * the screen shows, since the arming counts ticks. Up and down move the cursor, stopping at the
 * ends; fire plays the highlighted song from its start; left and right restart the playing song at
 * its previous or next section, stopping at the first and last; dash stops the music, or leaves
 * when nothing plays.
 */
export function pressJukebox(jukebox: Jukebox, press: JukeboxPress | null): JukeboxOutcome {
  const armed = jukebox.armIn === 0;
  if (!armed) jukebox.armIn--;
  switch (press) {
    case 'up':
    case 'down':
      jukebox.cursor = clamp(jukebox.cursor + (press === 'down' ? 1 : -1), 0, jukebox.tracks.length - 1);
      return STAY;
    case 'fire':
      return armed ? playHighlighted(jukebox) : STAY;
    case 'left':
    case 'right':
      return stepSection(jukebox, press === 'right' ? 1 : -1);
    case 'dash':
      return stopOrLeave(jukebox);
    case null:
      return STAY;
  }
}

/**
 * Takes the key of an `audio.played` song event: a `name:section` key for the playing song makes
 * that section the one sounding, and `name:end` (a one-shot ran out) leaves nothing playing. Keys
 * for other songs, and song starts, change nothing.
 */
export function hearJukebox(jukebox: Jukebox, key: string): void {
  const prefix = `${jukebox.playing}:`;
  if (jukebox.playing === null || !key.startsWith(prefix)) return;
  const heard = key.slice(prefix.length);
  if (heard === SONG_ENDED) {
    jukebox.playing = null;
    jukebox.section = null;
  } else jukebox.section = heard;
}

/** The highlighted track. */
export function selectedTrack(jukebox: Jukebox): JukeboxTrack {
  const track = jukebox.tracks[jukebox.cursor];
  if (!track) throw new Error(`Jukebox cursor ${jukebox.cursor} is outside its ${jukebox.tracks.length} tracks`);
  return track;
}

function playHighlighted(jukebox: Jukebox): JukeboxOutcome {
  const { name, song } = selectedTrack(jukebox);
  jukebox.playing = name;
  // A section on the first beat is never announced, since the song start stands for it.
  jukebox.section = song.sections.find((section) => section.bar === 0)?.name ?? null;
  return { kind: 'play', song: name };
}

function stepSection(jukebox: Jukebox, direction: 1 | -1): JukeboxOutcome {
  const playing = jukebox.tracks.find((track) => track.name === jukebox.playing);
  if (!playing || playing.song.sections.length === 0) return STAY;
  const sections = playing.song.sections;
  const current = sections.findIndex((section) => section.name === jukebox.section);
  const target = sections[clamp(current + direction, 0, sections.length - 1)];
  if (!target) return STAY;
  // A section that plays from its first beat is not announced, so the screen names it here.
  jukebox.section = target.name;
  return { kind: 'play', song: playing.name, section: target.name };
}

function stopOrLeave(jukebox: Jukebox): JukeboxOutcome {
  if (jukebox.playing === null) return { kind: 'leave' };
  jukebox.playing = null;
  jukebox.section = null;
  return { kind: 'stop' };
}

/** The list as drawn: a heading before each race set's tracks and before the other songs. */
export function jukeboxLines(tracks: readonly JukeboxTrack[]): JukeboxLine[] {
  const lines: JukeboxLine[] = [];
  let heading: string | null = null;
  tracks.forEach((track, index) => {
    const text = track.set === null ? OTHER_HEADING : track.set.toUpperCase();
    if (text !== heading) lines.push({ kind: 'heading', text });
    heading = text;
    lines.push({ kind: 'track', index });
  });
  return lines;
}

/**
 * The first of `lines` to draw when `shown` fit, keeping the cursor's line in view and as near the
 * middle as the list's ends allow; 0 when everything fits.
 */
export function firstShownLine(lines: readonly JukeboxLine[], cursor: number, shown: number): number {
  const cursorLine = lines.findIndex((line) => line.kind === 'track' && line.index === cursor);
  return clamp(cursorLine - Math.floor(shown / 2), 0, Math.max(0, lines.length - shown));
}

/**
 * The detail line for `song`: its key when it declares one, tempo, meter and how long it plays in
 * whole seconds, the loop for a looping song and the whole song for a one-shot.
 */
export function trackDetail(song: Song): string {
  const loopBeats = song.lengthBeats - (song.loopStart ?? 0);
  const seconds = Math.round((loopBeats * 60) / song.bpm);
  const length = song.loopStart === null ? `${seconds} S ONCE` : `${seconds} S LOOP`;
  const key = song.key ? `${PITCH_CLASS_NAMES[song.key.tonic]} ${song.key.mode.toUpperCase()}` : null;
  return [key, `${song.bpm} BPM`, song.meter, length].filter((part) => part !== null).join('  ');
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}
