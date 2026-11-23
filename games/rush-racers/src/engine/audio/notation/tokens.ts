/**
 * Lexing for channel lines: splits a line into tokens, expands `[ ... ]xN` repeats, and reads
 * one note, rest or drum token into its pitch, length in beats and modifiers.
 */
import { failAt } from './errors.ts';
import type { NoteEvent, Place } from './types.ts';

/** A note token's meaning before it is placed in time. */
export interface ParsedToken {
  /** Null for a rest. */
  pitch: NoteEvent['pitch'] | null;
  beats: number;
  tie: boolean;
  vibrato: boolean;
  slide: number | undefined;
  velocity: number;
}

const DIVISIONS: readonly number[] = [1, 2, 4, 8, 16, 32];
const DRUMS = { k: 'kick', s: 'snare', h: 'hat' } as const;
const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NOTE_TOKEN = /^(?<sound>[A-G][#b]?-?\d|[rksh])\/(?<division>\d+)(?<dot>\.?)(?<modifiers>.*)$/;
const MODIFIER = /~|v|>[+-]\d+|@(?:0(?:\.\d+)?|1(?:\.0+)?)/y;
const REPEAT_CLOSE = /^\]x(?<count>\d+)$/;

/**
 * Splits a channel line into note tokens and `|` bar lines, with repeats expanded.
 * `start` locates the line for errors.
 *
 * @throws {Error} When a repeat is unclosed, closed without a count, or closed without opening.
 */
export function tokenizeLine(value: string, start: Place): string[] {
  const spaced = value.replaceAll('[', ' [ ').replaceAll(']', ' ]').replaceAll('|', ' | ');
  return expandRepeats(spaced.split(/\s+/).filter(Boolean), start);
}

/** Flattens `[ ... ]xN` groups, innermost first. */
function expandRepeats(tokens: string[], start: Place): string[] {
  const groups: string[][] = [[]];
  // Bar lines written so far, repeats expanded, place an error in the bar it sits in.
  const at = (token: string): Place => ({
    ...start,
    bar: start.bar + groups.flat().filter((written) => written === '|').length,
    token,
  });
  for (const token of tokens) {
    const close = REPEAT_CLOSE.exec(token);
    if (token === '[') {
      groups.push([]);
    } else if (close) {
      if (groups.length === 1) failAt(at(token), 'this "]xN" has no opening "["');
      const count = Number(close.groups?.count);
      if (count < 1) failAt(at(token), 'repeat count must be at least 1');
      const body = groups.pop() ?? [];
      for (let i = 0; i < count; i++) groups.at(-1)?.push(...body);
    } else if (token.startsWith(']')) {
      failAt(at(token), 'close a repeat with "]xN", e.g. "]x2"');
    } else {
      groups.at(-1)?.push(token);
    }
  }
  if (groups.length > 1) failAt(at('['), 'repeat is never closed with "]xN"');
  return groups[0] ?? [];
}

/**
 * Reads one note, rest or drum token (`C5/8.`, `r/4`, `k/16@0.5`); see the notation module doc.
 *
 * @throws {Error} When the token is malformed, uses an unknown division or modifier, or puts a
 *   drum on a pitched channel or a pitch on noise.
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
