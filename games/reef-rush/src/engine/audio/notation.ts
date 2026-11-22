/**
 * The soundtrack's text notation and its parser: songs are written as compact
 * text per channel and parsed into timed note events the sequencer schedules.
 * Pure TypeScript with no WebAudio, so it is unit tested directly.
 *
 * Grammar (one directive per line; `//` starts a comment):
 *
 * - `name: <text>` and `tempo: <bpm>` are required.
 * - `time: <n>/<d>` sets the time signature (default 4/4; d is 2, 4 or 8). A beat is a
 *   quarter note, so 6/8 has 3 beats per bar. It must come before the first note line.
 * - `loop: <section>` makes the song loop back to that section's first bar; without it the
 *   song is a one-shot jingle.
 * - `voice <channel>: key=value ...` sets `duty` (0.125, 0.25, 0.5, 0.75; pulse channels
 *   only), `level`, and the envelope's `attack`, `decay`, `sustain`, `release`.
 * - `section: <name>` starts a named section at the current bar.
 * - `<channel>: <tokens>` appends to `pulse1`, `pulse2`, `triangle` or `noise`. A channel
 *   may have several lines per section. A channel with no lines in a section rests through
 *   it; channels that do play must all fill the same number of bars.
 *
 * Tokens:
 *
 * - A note is `<sound>/<division>`: `C5/8` is an eighth-note C5 (C4 is MIDI 60; `#` and `b`
 *   are sharp and flat), `r/4` a quarter rest. Noise plays drums: `k` kick, `s` snare, `h` hat.
 *   Divisions are 1, 2, 4, 8, 16 and 32; a trailing `.` dots the note (1.5x).
 * - Modifiers follow the division in any order: `~` ties into the next note (same pitch),
 *   `v` adds vibrato, `>+3` / `>-12` slides by that many semitones over the note (stored as
 *   the relative offset in `slideTo`), `@0.5` sets velocity (default 1).
 * - `|` ends a bar, and so does the end of a line. Every bar must fill the time signature.
 * - `[ ... ]x3` repeats the enclosed tokens (bar lines included); repeats nest.
 *
 * Example, a 2-bar loop:
 *
 * ```
 * name: demo
 * tempo: 140
 * loop: verse
 * voice pulse1: duty=0.25 level=0.5
 * section: verse
 * pulse1: C5/8 E5/8 G5/4. r/8 C6/4~ | C6/2 G5/4v A5/4>-2
 * triangle: [C3/8 C4/8]x4 | [G2/8 G3/8]x4
 * noise: [k/8 h/8@0.4 s/8 h/8@0.4]x2 | [k/8 h/8@0.4 s/8 h/8@0.4]x2
 * ```
 *
 * Errors name the channel, the 1-based bar, the source line and the token.
 */

import { closeSection, createTrack, type Track, writeChannelLine } from './notation/bars.ts';
import { failLine } from './notation/errors.ts';
import { collectNotes } from './notation/events.ts';
import { applyVoiceSettings, defaultVoice, parseTempo, parseTime, requireText } from './notation/header.ts';
import type { Channel, ChannelVoice, Line, Song } from './notation/types.ts';

export type { Channel, ChannelVoice, Duty, Envelope, NoteEvent, Song } from './notation/types.ts';

const CHANNELS: readonly Channel[] = ['pulse1', 'pulse2', 'triangle', 'noise'];
const DIRECTIVE = /^(?<key>[a-z0-9]+)(?:\s+(?<arg>\S+))?\s*:\s*(?<value>.*)$/i;

/** Everything parsed so far. */
interface ParseState {
  name: string | null;
  bpm: number | null;
  beatsPerBar: number;
  notesStarted: boolean;
  loop: { section: string; line: number } | null;
  sections: { name: string; bar: number }[];
  voices: Record<Channel, ChannelVoice>;
  tracks: Record<Channel, Track>;
}

/**
 * Parses a song written in the game's notation (grammar in the module doc).
 *
 * @throws {Error} Naming the channel, bar and token when the source is malformed or a bar's
 *   length doesn't match the time signature.
 */
export function parseSong(source: string): Song {
  const state = createState();
  source.split('\n').forEach((raw, index) => {
    const text = raw.replace(/\/\/.*$/, '').trim();
    if (text !== '') parseLine(state, { number: index + 1, text });
  });
  return finishSong(state);
}

function createState(): ParseState {
  const voices = {} as Record<Channel, ChannelVoice>;
  const tracks = {} as Record<Channel, Track>;
  for (const channel of CHANNELS) {
    voices[channel] = defaultVoice(channel);
    tracks[channel] = createTrack(channel);
  }
  return { name: null, bpm: null, beatsPerBar: 4, notesStarted: false, loop: null, sections: [], voices, tracks };
}

/** Routes one non-empty line to the stage that handles its directive. */
function parseLine(state: ParseState, line: Line): void {
  const groups = DIRECTIVE.exec(line.text)?.groups;
  const key = groups?.key?.toLowerCase();
  const arg = groups?.arg;
  const value = groups?.value?.trim() ?? '';
  if (key === undefined) failLine(line, 'expected "<directive>: <value>", e.g. "pulse1: C5/4 E5/4 G5/2"');
  if (key === 'voice') {
    if (arg === undefined || !isChannel(arg))
      failLine(line, '"voice" needs a channel: pulse1, pulse2, triangle or noise');
    applyVoiceSettings(state.voices[arg], arg, value, line);
    return;
  }
  if (arg !== undefined) failLine(line, 'only "voice <channel>:" takes an argument');
  if (isChannel(key)) {
    state.notesStarted = true;
    writeChannelLine(state.tracks[key], value, line.number, state.beatsPerBar);
  } else if (key === 'section') startSection(state, requireText(value, line));
  else if (key === 'name') state.name = requireText(value, line);
  else if (key === 'tempo') state.bpm = parseTempo(value, line);
  else if (key === 'time') {
    if (state.notesStarted) failLine(line, 'the time signature must come before the first note line');
    state.beatsPerBar = parseTime(value, line);
  } else if (key === 'loop') state.loop = { section: requireText(value, line), line: line.number };
  else failLine(line, `unknown directive "${key}"; use name, tempo, time, loop, voice, section or a channel`);
}

function isChannel(key: string): key is Channel {
  return (CHANNELS as readonly string[]).includes(key);
}

function allTracks(state: ParseState): Track[] {
  return CHANNELS.map((channel) => state.tracks[channel]);
}

function startSection(state: ParseState, name: string): void {
  if (state.sections.some((section) => section.name === name)) {
    throw new Error(`section "${name}" is declared twice; section names must be unique`);
  }
  const bar = closeSection(allTracks(state), state.sections.at(-1)?.name);
  state.sections.push({ name, bar });
}

function finishSong(state: ParseState): Song {
  const bars = closeSection(allTracks(state), state.sections.at(-1)?.name);
  const notes = collectNotes(allTracks(state));
  if (state.name === null) throw new Error('song is missing "name: <text>"');
  if (state.bpm === null) throw new Error(`song "${state.name}" is missing "tempo: <bpm>"`);
  if (bars === 0) throw new Error(`song "${state.name}" has no bars; add a channel line such as "pulse1: C5/1"`);
  return {
    name: state.name,
    bpm: state.bpm,
    beatsPerBar: state.beatsPerBar,
    lengthBeats: bars * state.beatsPerBar,
    loopStart: resolveLoop(state),
    sections: state.sections,
    voices: state.voices,
    notes,
  };
}

function resolveLoop(state: ParseState): number | null {
  if (state.loop === null) return null;
  const { section: name, line } = state.loop;
  const section = state.sections.find((candidate) => candidate.name === name);
  if (!section) {
    const known = state.sections.map((candidate) => candidate.name).join(', ') || 'none';
    throw new Error(`line ${line}: loop names section "${name}", which doesn't exist (sections: ${known})`);
  }
  return section.bar * state.beatsPerBar;
}
