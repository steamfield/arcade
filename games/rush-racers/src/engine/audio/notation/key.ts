/**
 * The `key:` header: reads a tonic and mode into the song's declared key.
 */
import { failLine } from './errors.ts';
import { pitchClassOf, transpose } from './pitch.ts';
import type { Line, SongKey } from './types.ts';

/** Each mode's scale as semitones above the tonic. */
const MODES: Record<string, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  'harmonic-minor': [0, 2, 3, 5, 7, 8, 11],
};

/**
 * Reads `key: <tonic> <mode>`, e.g. `D dorian`.
 *
 * @throws {Error} Naming the line and listing the modes when the tonic or mode is unknown.
 */
export function parseKey(value: string, line: Line): SongKey {
  const [tonicText = '', mode = '', ...extra] = value.split(/\s+/).filter(Boolean);
  const modeList = listModes();
  if (mode === '' || extra.length > 0) failLine(line, `key must look like "D dorian"; modes are ${modeList}`);
  const tonic = pitchClassOf(tonicText);
  if (tonic === null) failLine(line, `unknown tonic "${tonicText}"; use a letter A to G with an optional # or b`);
  const intervals = MODES[mode];
  if (intervals === undefined) failLine(line, `unknown mode "${mode}"; use ${modeList}`);
  return { tonic, mode, scale: intervals.map((interval) => transpose(tonic, interval)) };
}

function listModes(): string {
  const names = Object.keys(MODES);
  return `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`;
}
