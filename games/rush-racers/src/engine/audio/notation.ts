/**
 * The soundtrack's text notation and its parser: songs are written as compact
 * text per channel and parsed into timed note events the sequencer schedules.
 * Pure TypeScript with no WebAudio, so it is unit tested directly.
 *
 * Grammar (one directive per line; `//` starts a comment):
 *
 * - `name: <text>` and `tempo: <bpm>` are required. `title: <text>` is the name shown to
 *   people (default: the name); everything after the first colon is kept, colons included.
 * - `key: <tonic> <mode>`, e.g. `key: D dorian`, declares the key for analysis. Modes: major,
 *   minor, dorian, mixolydian, lydian, phrygian, harmonic-minor.
 * - `time: <n>/<d>` sets the time signature (default 4/4; d is 2, 4 or 8). A beat is a
 *   quarter note, so 6/8 has 3 beats per bar. It must come before the first note or chord line.
 * - `loop: <section>` makes the song loop back to that section's first bar; without it the
 *   song is a one-shot jingle.
 * - `voice <channel>: key=value ...` sets `duty` (0.125, 0.25, 0.5, 0.75; pulse channels
 *   only), `level`, the envelope's `attack`, `decay`, `sustain`, `release`, `detune` in cents
 *   (-50..50, pulse and triangle) and `arp`, the sixtieths of a second per arpeggio step
 *   (1, 2 or 3; the synth uses 2 when it is left out).
 * - `section: <name>` starts a named section at the current bar.
 * - `<channel>: <tokens>` appends to `pulse1`, `pulse2`, `triangle` or `noise`. A channel
 *   may have several lines per section. A channel with no lines in a section rests through
 *   it; channels that do play must all fill the same number of bars.
 * - `chords: Dm | C | G7 | Bb` charts the section's chords, one bar per `|`; symbols sharing a
 *   bar split it evenly (`Am D` is half a bar each). Repeats work as in channel lines. A
 *   section's `chords:` lines together must cover exactly its bars. Symbols are a root
 *   `[A-G][#b]?` plus none (major), `m`, `7`, `m7`, `maj7`, `dim`, `sus2`, `sus4`, `5`, `6` or
 *   `m6`. The chart annotates the song for analysis and never changes what plays.
 * - `duty <pulse>: <0.125|0.25|0.5|0.75>` sets the duty of that pulse's later notes, across
 *   sections, until the next `duty` line for it; `duty pulse1: voice` returns to the voice's.
 * - `echo pulse2: pulse1 delay=0.75 level=0.45` makes pulse2 replay pulse1's notes of this
 *   section `delay` beats later (above 0, at most 4) at `level` times their velocity (above 0,
 *   at most 1), in place of its own lines. Either pulse may echo the other, and the line may
 *   come before or after the source's lines. Each echo is cut where the next starts and at
 *   the section end; echoes that would start at or past the end are dropped.
 *
 * Tokens:
 *
 * - A note is `<sound>/<division>`: `C5/8` is an eighth-note C5 (C4 is MIDI 60; `#` and `b`
 *   are sharp and flat), `r/4` a quarter rest. Noise plays drums: `k` kick, `s` snare, `h`
 *   hat, `o` open hat, `c` crash, `t` tom. Divisions are 1, 2, 4, 8, 16 and 32; a trailing `.`
 *   dots the note (1.5x).
 * - `C4:047/4` is an arpeggio: the pitch cycles through the note plus each hex offset in
 *   semitones (`0`-`9`, `a`-`f`), in order, for the note's length. Two to six offsets, on
 *   pulse and triangle notes, never with a slide.
 * - Modifiers follow the division in any order: `~` ties into the next note (same pitch),
 *   `v` adds vibrato, `>+3` / `>-12` slides by that many semitones over the note (stored as
 *   the relative offset in `slideTo`), `@0.5` sets velocity (default 1), and `!` on a triangle
 *   note drops its pitch for a kick (low notes) or tom (higher ones), never with `~`, `v`, a
 *   slide or an arpeggio.
 * - `|` ends a bar, and so does the end of a line. Every bar must fill the time signature.
 * - `[ ... ]x3` repeats the enclosed tokens (bar lines included); repeats nest.
 *
 * Example, a 2-bar loop:
 *
 * ```
 * name: demo
 * title: Demo Loop
 * tempo: 140
 * key: C major
 * loop: verse
 * voice pulse1: duty=0.25 level=0.5
 * section: verse
 * chords: C | G7
 * pulse1: C5/8 E5/8 G5/4. r/8 C6/4~ | C6/2 G5/4v A5/4>-2
 * echo pulse2: pulse1 delay=0.75 level=0.4
 * triangle: [C3/8! C4/8]x4 | [G2/8! G3/8]x4
 * noise: [k/8 h/8@0.4 s/8 h/8@0.4]x2 | [k/8 h/8@0.4 s/8 o/8@0.4]x2
 * ```
 *
 * Errors name the channel, the 1-based bar, the source line and the token.
 */

import { createTrack, type Track, writeChannelLine } from './notation/bars.ts';
import { createChordChart, writeChordLine } from './notation/chords.ts';
import { parseDutyDirective } from './notation/duty.ts';
import { parseEchoDirective } from './notation/echo.ts';
import { failLine } from './notation/errors.ts';
import { collectNotes } from './notation/events.ts';
import { applyVoiceSettings, defaultVoice, parseTempo, parseTime, requireText } from './notation/header.ts';
import { parseKey } from './notation/key.ts';
import { addEcho, closeOpenSection, type OpenSection } from './notation/sections.ts';
import type { Channel, ChannelVoice, Line, Song, SongKey } from './notation/types.ts';

export type {
  Channel,
  ChannelVoice,
  ChordSpan,
  Drum,
  Duty,
  Envelope,
  NoteEvent,
  Song,
  SongKey,
} from './notation/types.ts';

const CHANNELS: readonly Channel[] = ['pulse1', 'pulse2', 'triangle', 'noise'];
const DIRECTIVE = /^(?<key>[a-z0-9]+)(?:\s+(?<arg>\S+))?\s*:\s*(?<value>.*)$/i;

/** Everything parsed so far. */
interface ParseState extends OpenSection {
  name: string | null;
  title: string | null;
  key: SongKey | null;
  bpm: number | null;
  /** The time signature as written. */
  meter: string;
  /** Whether a note or chord line has placed bars yet, after which the meter is fixed. */
  barsStarted: boolean;
  loop: { section: string; line: number } | null;
  sections: { name: string; bar: number }[];
  voices: Record<Channel, ChannelVoice>;
}

/** Reads one directive that takes no argument into the parse state. */
type DirectiveReader = (state: ParseState, value: string, line: Line) => void;

/** Look readers up with `Object.hasOwn`, so a directive such as `constructor:` stays unknown. */
const DIRECTIVES: Readonly<Record<string, DirectiveReader>> = {
  name: (state, value, line) => {
    state.name = requireText(value, line);
  },
  title: (state, value, line) => {
    state.title = requireText(value, line);
  },
  tempo: (state, value, line) => {
    state.bpm = parseTempo(value, line);
  },
  key: (state, value, line) => {
    state.key = parseKey(value, line);
  },
  time: (state, value, line) => {
    if (state.barsStarted) failLine(line, 'the time signature must come before the first note or chord line');
    state.beatsPerBar = parseTime(value, line);
    state.meter = value;
  },
  loop: (state, value, line) => {
    state.loop = { section: requireText(value, line), line: line.number };
  },
  section: (state, value, line) => startSection(state, requireText(value, line)),
  chords: (state, value, line) => {
    state.barsStarted = true;
    writeChordLine(state.chart, value, line, state.beatsPerBar);
  },
};

/**
 * Parses a song written in the game's notation (grammar in the module doc).
 *
 * @throws {Error} Naming the channel, bar and token when the source is malformed or a bar's
 *   length doesn't match the time signature, and naming the line for a malformed header,
 *   chord chart, `duty` or `echo` line.
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
  return {
    name: null,
    title: null,
    key: null,
    bpm: null,
    beatsPerBar: 4,
    meter: '4/4',
    barsStarted: false,
    loop: null,
    sections: [],
    voices,
    tracks,
    chart: createChordChart(),
    echoes: [],
  };
}

/** Routes one non-empty line to the stage that handles its directive. */
function parseLine(state: ParseState, line: Line): void {
  const groups = DIRECTIVE.exec(line.text)?.groups;
  const key = groups?.key?.toLowerCase();
  const arg = groups?.arg;
  const value = groups?.value?.trim() ?? '';
  if (key === undefined) failLine(line, 'expected "<directive>: <value>", e.g. "pulse1: C5/4 E5/4 G5/2"');
  if (key === 'voice' || key === 'duty' || key === 'echo') {
    if (arg === undefined || !isChannel(arg))
      failLine(line, `"${key}" needs a channel: pulse1, pulse2, triangle or noise`);
    parseChannelDirective(state, key, arg, value, line);
    return;
  }
  if (arg !== undefined) failLine(line, 'only "voice", "duty" and "echo" take a channel before the colon');
  if (isChannel(key)) {
    state.barsStarted = true;
    writeChannelLine(state.tracks[key], value, line.number, state.beatsPerBar);
    return;
  }
  const reader = Object.hasOwn(DIRECTIVES, key) ? DIRECTIVES[key] : undefined;
  if (reader === undefined) {
    failLine(
      line,
      `unknown directive "${key}"; use name, title, tempo, key, time, loop, voice, section, chords, duty, echo or a channel`,
    );
  }
  reader(state, value, line);
}

/** Reads a directive that names a channel before its colon: `voice`, `duty` or `echo`. */
function parseChannelDirective(
  state: ParseState,
  key: 'voice' | 'duty' | 'echo',
  channel: Channel,
  value: string,
  line: Line,
): void {
  if (key === 'voice') applyVoiceSettings(state.voices[channel], channel, value, line);
  else if (key === 'duty') state.tracks[channel].duty = parseDutyDirective(channel, value, line);
  else addEcho(state, parseEchoDirective(channel, value, line));
}

function isChannel(key: string): key is Channel {
  return (CHANNELS as readonly string[]).includes(key);
}

function startSection(state: ParseState, name: string): void {
  if (state.sections.some((section) => section.name === name)) {
    throw new Error(`section "${name}" is declared twice; section names must be unique`);
  }
  const bar = closeOpenSection(state, state.sections.at(-1)?.name);
  state.sections.push({ name, bar });
}

function finishSong(state: ParseState): Song {
  const bars = closeOpenSection(state, state.sections.at(-1)?.name);
  const notes = collectNotes(CHANNELS.map((channel) => state.tracks[channel]));
  if (state.name === null) throw new Error('song is missing "name: <text>"');
  if (state.bpm === null) throw new Error(`song "${state.name}" is missing "tempo: <bpm>"`);
  if (bars === 0) throw new Error(`song "${state.name}" has no bars; add a channel line such as "pulse1: C5/1"`);
  return {
    name: state.name,
    title: state.title ?? state.name,
    key: state.key,
    chords: state.chart.spans,
    bpm: state.bpm,
    beatsPerBar: state.beatsPerBar,
    meter: state.meter,
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
