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

/** The four voices, like classic handheld hardware. */
export type Channel = 'pulse1' | 'pulse2' | 'triangle' | 'noise';

/** Pulse-wave duty cycle as a fraction of the period. */
export type Duty = 0.125 | 0.25 | 0.5 | 0.75;

/** A volume shape for each note: times in seconds, levels 0..1. */
export interface Envelope {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

/** One note or drum hit. Times are in beats from the song start; rests produce no event. */
export interface NoteEvent {
  channel: Channel;
  /** Start in beats. */
  start: number;
  /** Length in beats. */
  length: number;
  /** MIDI note number for pitched channels; for noise, the drum: 'kick' | 'snare' | 'hat'. */
  pitch: number | 'kick' | 'snare' | 'hat';
  /** 0..1 relative to the channel's level. */
  velocity: number;
  /** Semitones to slide to over the note, if any. */
  slideTo?: number;
  vibrato?: boolean;
}

/** Per-channel voice settings for a song. */
export interface ChannelVoice {
  duty?: Duty;
  envelope: Envelope;
  /** 0..1 mix level. */
  level: number;
}

/** A parsed song, ready to schedule. */
export interface Song {
  name: string;
  /** Beats per minute at tempo scale 1. */
  bpm: number;
  /** Beats per bar (time signature numerator over a quarter-note beat). */
  beatsPerBar: number;
  /** Total length in beats. */
  lengthBeats: number;
  /** Beat the song jumps back to when it loops, or null for one-shot jingles. */
  loopStart: number | null;
  /** Bar numbers (0-based) where a named section starts, for `audio.played` section events. */
  sections: { name: string; bar: number }[];
  voices: Record<Channel, ChannelVoice>;
  notes: NoteEvent[];
}

const CHANNELS: readonly Channel[] = ['pulse1', 'pulse2', 'triangle', 'noise'];
const DUTIES: readonly number[] = [0.125, 0.25, 0.5, 0.75];
const DIVISIONS: readonly number[] = [1, 2, 4, 8, 16, 32];
const DRUMS = { k: 'kick', s: 'snare', h: 'hat' } as const;
const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const DEFAULT_ENVELOPE: Envelope = { attack: 0.005, decay: 0.08, sustain: 0.6, release: 0.05 };
const DEFAULT_LEVEL = 0.5;

const NOTE_TOKEN = /^(?<sound>[A-G][#b]?-?\d|[rksh])\/(?<division>\d+)(?<dot>\.?)(?<modifiers>.*)$/;
const MODIFIER = /~|v|>[+-]\d+|@(?:0(?:\.\d+)?|1(?:\.0+)?)/y;
const DIRECTIVE = /^(?<key>[a-z0-9]+)(?:\s+(?<arg>\S+))?\s*:\s*(?<value>.*)$/i;
const REPEAT_CLOSE = /^\]x(?<count>\d+)$/;

/** Where in the source a token sits, so every error can point at it. */
interface Place {
  channel: Channel;
  /** 0-based bar; messages show it 1-based. */
  bar: number;
  line: number;
  token: string;
}

/** A note token's meaning before it is placed in time. */
interface ParsedToken {
  /** Null for a rest. */
  pitch: NoteEvent['pitch'] | null;
  beats: number;
  tie: boolean;
  vibrato: boolean;
  slide: number | undefined;
  velocity: number;
}

/** One channel's write head while parsing. */
interface Track {
  channel: Channel;
  bar: number;
  barBeats: number;
  events: NoteEvent[];
  /** The note a `~` is extending, with the token that opened the tie. */
  tie: { event: NoteEvent; place: Place } | null;
  playedInSection: boolean;
}

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

/** A source line, for header errors. */
interface Line {
  number: number;
  text: string;
}

function failAt(place: Place, detail: string): never {
  throw new Error(`${place.channel} bar ${place.bar + 1} (line ${place.line}), token "${place.token}": ${detail}`);
}

function failLine(line: Line, detail: string): never {
  throw new Error(`line ${line.number} "${line.text}": ${detail}`);
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
    const isPulse = channel === 'pulse1' || channel === 'pulse2';
    voices[channel] = { ...(isPulse ? { duty: 0.5 } : {}), envelope: { ...DEFAULT_ENVELOPE }, level: DEFAULT_LEVEL };
    tracks[channel] = { channel, bar: 0, barBeats: 0, events: [], tie: null, playedInSection: false };
  }
  return { name: null, bpm: null, beatsPerBar: 4, notesStarted: false, loop: null, sections: [], voices, tracks };
}

function parseLine(state: ParseState, line: Line): void {
  const groups = DIRECTIVE.exec(line.text)?.groups;
  const key = groups?.key?.toLowerCase();
  const arg = groups?.arg;
  const value = groups?.value?.trim() ?? '';
  if (key === undefined) failLine(line, 'expected "<directive>: <value>", e.g. "pulse1: C5/4 E5/4 G5/2"');
  if (key === 'voice') {
    parseVoice(state, arg, value, line);
    return;
  }
  if (arg !== undefined) failLine(line, 'only "voice <channel>:" takes an argument');
  if (isChannel(key)) parseChannelLine(state, state.tracks[key], value, line.number);
  else if (key === 'section') startSection(state, requireText(value, line));
  else if (key === 'name') state.name = requireText(value, line);
  else if (key === 'tempo') state.bpm = parseTempo(value, line);
  else if (key === 'time') state.beatsPerBar = parseTime(state, value, line);
  else if (key === 'loop') state.loop = { section: requireText(value, line), line: line.number };
  else failLine(line, `unknown directive "${key}"; use name, tempo, time, loop, voice, section or a channel`);
}

function isChannel(key: string): key is Channel {
  return (CHANNELS as readonly string[]).includes(key);
}

function requireText(value: string, line: Line): string {
  if (value === '') failLine(line, 'needs a value');
  return value;
}

function parseTempo(value: string, line: Line): number {
  const bpm = Number(value);
  if (!Number.isFinite(bpm) || bpm <= 0) failLine(line, `tempo must be a positive number of BPM, got "${value}"`);
  return bpm;
}

function parseTime(state: ParseState, value: string, line: Line): number {
  if (state.notesStarted) failLine(line, 'the time signature must come before the first note line');
  const match = /^(\d+)\/(2|4|8)$/.exec(value);
  if (!match || Number(match[1]) < 1) failLine(line, `time must look like "4/4", "3/4" or "6/8", got "${value}"`);
  return (Number(match[1]) * 4) / Number(match[2]);
}

function parseVoice(state: ParseState, arg: string | undefined, value: string, line: Line): void {
  if (arg === undefined || !isChannel(arg))
    failLine(line, '"voice" needs a channel: pulse1, pulse2, triangle or noise');
  const voice = state.voices[arg];
  for (const pair of value.split(/\s+/).filter(Boolean)) {
    const [setting = '', raw = ''] = pair.split('=');
    const number = Number(raw);
    if (raw === '' || !Number.isFinite(number) || number < 0) {
      failLine(line, `"${pair}" needs a non-negative number, e.g. level=0.5`);
    }
    if (setting === 'duty') {
      if (voice.duty === undefined) failLine(line, `only pulse channels have a duty, not ${arg}`);
      if (!DUTIES.includes(number)) failLine(line, `duty must be 0.125, 0.25, 0.5 or 0.75, got ${raw}`);
      voice.duty = number as Duty;
    } else if (setting === 'level' || setting === 'sustain') {
      if (number > 1) failLine(line, `${setting} must be 0..1, got ${raw}`);
      if (setting === 'level') voice.level = number;
      else voice.envelope.sustain = number;
    } else if (setting === 'attack' || setting === 'decay' || setting === 'release') {
      voice.envelope[setting] = number;
    } else {
      failLine(line, `unknown voice setting "${setting}"; use duty, level, attack, decay, sustain or release`);
    }
  }
}

function startSection(state: ParseState, name: string): void {
  if (state.sections.some((section) => section.name === name)) {
    throw new Error(`section "${name}" is declared twice; section names must be unique`);
  }
  const bar = closeSection(state);
  state.sections.push({ name, bar });
}

/** Lines every channel up at the end of a section and returns the bar the next one starts at. */
function closeSection(state: ParseState): number {
  const tracks = CHANNELS.map((channel) => state.tracks[channel]);
  const longest = tracks.reduce((a, b) => (b.bar > a.bar ? b : a));
  const sectionName = state.sections.at(-1)?.name;
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

function parseChannelLine(state: ParseState, track: Track, value: string, line: number): void {
  state.notesStarted = true;
  track.playedInSection = true;
  const spaced = value.replaceAll('[', ' [ ').replaceAll(']', ' ]').replaceAll('|', ' | ');
  const tokens = expandRepeats(spaced.split(/\s+/).filter(Boolean), {
    channel: track.channel,
    bar: track.bar,
    line,
    token: '',
  });
  let place: Place | null = null;
  for (const token of tokens) {
    place = { channel: track.channel, bar: track.bar, line, token };
    if (token === '|') closeBar(track, place, state.beatsPerBar);
    else writeNote(track, place, state.beatsPerBar);
  }
  if (place && track.barBeats > 0) closeBar(track, place, state.beatsPerBar);
}

/** Flattens `[ ... ]xN` groups, innermost first. `start` locates the line for errors. */
function expandRepeats(tokens: string[], start: Place): string[] {
  const groups: string[][] = [[]];
  for (const token of tokens) {
    const close = REPEAT_CLOSE.exec(token);
    if (token === '[') {
      groups.push([]);
    } else if (close) {
      const body = groups.pop() ?? [];
      const outer = groups.at(-1);
      if (!outer) failAt({ ...start, token }, 'this "]xN" has no opening "["');
      const count = Number(close.groups?.count);
      if (count < 1) failAt({ ...start, token }, 'repeat count must be at least 1');
      for (let i = 0; i < count; i++) outer.push(...body);
    } else if (token.startsWith(']')) {
      failAt({ ...start, token }, 'close a repeat with "]xN", e.g. "]x2"');
    } else {
      groups.at(-1)?.push(token);
    }
  }
  if (groups.length > 1) failAt({ ...start, token: '[' }, 'repeat is never closed with "]xN"');
  return groups[0] ?? [];
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
  const start = track.bar * beatsPerBar + track.barBeats;
  track.barBeats = filled;
  if (track.tie) {
    extendTie(track, track.tie, note, place);
    return;
  }
  if (note.pitch === null) return;
  const event: NoteEvent = {
    channel: track.channel,
    start,
    length: note.beats,
    pitch: note.pitch,
    velocity: note.velocity,
  };
  if (note.slide !== undefined) event.slideTo = note.slide;
  if (note.vibrato) event.vibrato = true;
  track.events.push(event);
  if (note.tie) track.tie = { event, place };
}

/** A tied note keeps the first note's velocity, slide and vibrato; later ones only add length. */
function extendTie(track: Track, tie: NonNullable<Track['tie']>, note: ParsedToken, place: Place): void {
  if (note.pitch !== tie.event.pitch)
    failAt(place, `the tie from "${tie.place.token}" must continue on the same pitch`);
  tie.event.length += note.beats;
  if (!note.tie) track.tie = null;
}

/** Reads one note, rest or drum token; see the module doc for the syntax. */
function parseNoteToken(place: Place): ParsedToken {
  const groups = NOTE_TOKEN.exec(place.token)?.groups;
  const sound = groups?.sound;
  if (!groups || sound === undefined) failAt(place, 'expected a note like "C5/8", a rest "r/4" or a drum "k/8"');
  const division = Number(groups.division);
  if (!DIVISIONS.includes(division)) failAt(place, `unknown division /${groups.division}; use 1, 2, 4, 8, 16 or 32`);
  const parsed: ParsedToken = {
    pitch: soundToPitch(sound, place),
    beats: (4 / division) * (groups.dot === '.' ? 1.5 : 1),
    tie: false,
    vibrato: false,
    slide: undefined,
    velocity: 1,
  };
  applyModifiers(parsed, groups.modifiers ?? '', place);
  return parsed;
}

function soundToPitch(sound: string, place: Place): ParsedToken['pitch'] {
  if (sound === 'r') return null;
  const isNoise = place.channel === 'noise';
  if (sound === 'k' || sound === 's' || sound === 'h') {
    if (!isNoise) failAt(place, `${place.channel} plays pitches; drums k, s and h belong on noise`);
    return DRUMS[sound];
  }
  if (isNoise) failAt(place, 'noise plays drums: k (kick), s (snare) or h (hat)');
  const letter = SEMITONES[sound.charAt(0)] ?? 0;
  const accidental = sound.charAt(1) === '#' ? 1 : sound.charAt(1) === 'b' ? -1 : 0;
  const octave = Number(sound.replace(/^[A-G][#b]?/, ''));
  const midi = (octave + 1) * 12 + letter + accidental;
  if (midi < 0 || midi > 127) failAt(place, 'pitch is outside MIDI 0..127');
  return midi;
}

function applyModifiers(parsed: ParsedToken, modifiers: string, place: Place): void {
  MODIFIER.lastIndex = 0;
  while (MODIFIER.lastIndex < modifiers.length) {
    const rest = modifiers.slice(MODIFIER.lastIndex);
    const modifier = MODIFIER.exec(modifiers)?.[0];
    if (modifier === undefined) {
      failAt(place, `unknown modifier "${rest}"; use ~ (tie), v (vibrato), >+N (slide) or @0.5 (velocity)`);
    }
    if (modifier === '~') parsed.tie = true;
    else if (modifier === 'v') parsed.vibrato = true;
    else if (modifier.startsWith('>')) parsed.slide = Number(modifier.slice(1));
    else parsed.velocity = Number(modifier.slice(1));
  }
  if (parsed.pitch === null && modifiers !== '') failAt(place, 'rests take no modifiers');
  if (typeof parsed.pitch === 'string' && (parsed.vibrato || parsed.slide !== undefined)) {
    failAt(place, 'drums take only ~ (tie) and @ (velocity)');
  }
}

function finishSong(state: ParseState): Song {
  const bars = closeSection(state);
  for (const channel of CHANNELS) {
    const tie = state.tracks[channel].tie;
    if (tie) failAt(tie.place, 'tie runs past the end of the song');
  }
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
    notes: CHANNELS.flatMap((channel) => state.tracks[channel].events).sort((a, b) => a.start - b.start),
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
