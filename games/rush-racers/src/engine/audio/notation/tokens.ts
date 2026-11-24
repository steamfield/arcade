/**
 * Lexing for channel and chord lines: splits a line into tokens, expands `[ ... ]xN` repeats,
 * and reads one note, rest or drum token into its pitch, length in beats and modifiers.
 */
import { failAt } from './errors.ts';
import { semitonesFromC } from './pitch.ts';
import type { Drum, NoteEvent, Place } from './types.ts';

/** A note token's meaning before it is placed in time. */
export interface ParsedToken {
  /** Null for a rest. */
  pitch: NoteEvent['pitch'] | null;
  beats: number;
  tie: boolean;
  vibrato: boolean;
  slide: number | undefined;
  velocity: number;
  /** Arpeggio offsets in semitones, when the token has a `:` part. */
  arp: readonly number[] | undefined;
  drop: boolean;
}

/**
 * Reports a malformed repeat in a tokenized line.
 * `barsBefore` counts the bar lines written ahead of the token, repeats expanded.
 */
export type RepeatError = (token: string, barsBefore: number, detail: string) => never;

const DIVISIONS: readonly number[] = [1, 2, 4, 8, 16, 32];
const DRUMS: Record<string, Drum> = { k: 'kick', s: 'snare', h: 'hat', o: 'openHat', c: 'crash', t: 'tom' };
const NOTE_TOKEN =
  /^(?<sound>[A-G][#b]?-?\d|[rkshoct])(?::(?<arp>[^/]*))?\/(?<division>\d+)(?<dot>\.?)(?<modifiers>.*)$/;
const ARP_OFFSETS = /^[0-9a-f]{2,6}$/;
const HEX = 16;
const MODIFIER = /~|v|!|>[+-]\d+|@(?:0(?:\.\d+)?|1(?:\.0+)?)/y;
const REPEAT_CLOSE = /^\]x(?<count>\d+)$/;

/**
 * Splits a channel line into note tokens and `|` bar lines, with repeats expanded.
 * `start` locates the line for errors.
 *
 * @throws {Error} When a repeat is unclosed, closed without a count, or closed without opening.
 */
export function tokenizeLine(value: string, start: Place): string[] {
  return splitRepeated(value, (token, barsBefore, detail) =>
    failAt({ ...start, bar: start.bar + barsBefore, token }, detail),
  );
}

/**
 * Splits a line on whitespace into tokens and `|` bar lines, with `[ ... ]xN` repeats expanded.
 *
 * @throws {Error} Whatever `fail` throws, when a repeat is unclosed, closed without a count, or
 *   closed without opening.
 */
export function splitRepeated(value: string, fail: RepeatError): string[] {
  const spaced = value.replaceAll('[', ' [ ').replaceAll(']', ' ]').replaceAll('|', ' | ');
  return expandRepeats(spaced.split(/\s+/).filter(Boolean), fail);
}

/** Flattens `[ ... ]xN` groups, innermost first. */
function expandRepeats(tokens: string[], fail: RepeatError): string[] {
  const groups: string[][] = [[]];
  // Bar lines written so far, repeats expanded, place an error in the bar it sits in.
  const failHere = (token: string, detail: string): never =>
    fail(token, groups.flat().filter((written) => written === '|').length, detail);
  for (const token of tokens) {
    const close = REPEAT_CLOSE.exec(token);
    if (token === '[') {
      groups.push([]);
    } else if (close) {
      if (groups.length === 1) failHere(token, 'this "]xN" has no opening "["');
      const count = Number(close.groups?.count);
      if (count < 1) failHere(token, 'repeat count must be at least 1');
      const body = groups.pop() ?? [];
      for (let i = 0; i < count; i++) groups.at(-1)?.push(...body);
    } else if (token.startsWith(']')) {
      failHere(token, 'close a repeat with "]xN", e.g. "]x2"');
    } else {
      groups.at(-1)?.push(token);
    }
  }
  if (groups.length > 1) failHere('[', 'repeat is never closed with "]xN"');
  return groups[0] ?? [];
}

/**
 * Reads one note, rest or drum token (`C5/8.`, `r/4`, `k/16@0.5`, `C4:047/4`); see the
 * notation module doc.
 *
 * @throws {Error} When the token is malformed, uses an unknown division or modifier, puts a
 *   drum on a pitched channel or a pitch on noise, or combines an arpeggio or drop with
 *   something it can't take.
 */
export function parseNoteToken(place: Place): ParsedToken {
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
    arp: undefined,
    drop: false,
  };
  applyModifiers(parsed, groups.modifiers ?? '', place);
  if (groups.arp !== undefined) parsed.arp = parseArp(parsed, groups.arp, place);
  return parsed;
}

function soundToPitch(sound: string, place: Place): ParsedToken['pitch'] {
  if (sound === 'r') return null;
  const isNoise = place.channel === 'noise';
  const drum = DRUMS[sound];
  if (drum !== undefined) {
    if (!isNoise) failAt(place, `${place.channel} plays pitches; drums k, s, h, o, c and t belong on noise`);
    return drum;
  }
  if (isNoise) failAt(place, 'noise plays drums: k (kick), s (snare), h (hat), o (open hat), c (crash) or t (tom)');
  const spelling = sound.replace(/-?\d$/, '');
  const octave = Number(sound.slice(spelling.length));
  const midi = (octave + 1) * 12 + (semitonesFromC(spelling) ?? 0);
  if (midi < 0 || midi > 127) failAt(place, 'pitch is outside MIDI 0..127');
  return midi;
}

function applyModifiers(parsed: ParsedToken, modifiers: string, place: Place): void {
  MODIFIER.lastIndex = 0;
  while (MODIFIER.lastIndex < modifiers.length) {
    const rest = modifiers.slice(MODIFIER.lastIndex);
    const modifier = MODIFIER.exec(modifiers)?.[0];
    if (modifier === undefined) {
      failAt(place, `unknown modifier "${rest}"; use ~ (tie), v (vibrato), ! (drop), >+N (slide) or @0.5 (velocity)`);
    }
    if (modifier === '~') parsed.tie = true;
    else if (modifier === 'v') parsed.vibrato = true;
    else if (modifier === '!') parsed.drop = true;
    else if (modifier.startsWith('>')) parsed.slide = Number(modifier.slice(1));
    else parsed.velocity = Number(modifier.slice(1));
  }
  if (parsed.pitch === null && modifiers !== '') failAt(place, 'rests take no modifiers');
  if (typeof parsed.pitch === 'string' && (parsed.vibrato || parsed.slide !== undefined || parsed.drop)) {
    failAt(place, 'drums take only ~ (tie) and @ (velocity)');
  }
  if (parsed.drop) checkDrop(parsed, place);
}

/** A drop is a triangle thump: it has no sustain to tie, wobble or slide. */
function checkDrop(parsed: ParsedToken, place: Place): void {
  if (place.channel !== 'triangle') failAt(place, `only triangle notes take "!" (drop), not ${place.channel}`);
  if (parsed.tie || parsed.vibrato || parsed.slide !== undefined) {
    failAt(place, "a drop can't take a tie, vibrato or slide");
  }
}

function parseArp(parsed: ParsedToken, offsets: string, place: Place): number[] {
  if (typeof parsed.pitch !== 'number') failAt(place, 'only pitched notes on pulse or triangle take an arpeggio');
  if (!ARP_OFFSETS.test(offsets)) {
    failAt(place, 'an arpeggio needs 2 to 6 offsets, hex digits 0-9 and a-f, e.g. "C4:047/4"');
  }
  if (parsed.slide !== undefined) failAt(place, "an arpeggio can't slide; drop the >N or the :offsets");
  return [...offsets].map((digit) => Number.parseInt(digit, HEX));
}
