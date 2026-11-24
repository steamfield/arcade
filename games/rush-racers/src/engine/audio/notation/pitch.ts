/**
 * Pitch spelling: reads a letter name with an optional sharp or flat (`C`, `F#`, `Bb`), the
 * part every note, key tonic and chord root shares.
 */

const LETTER_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SPELLING = /^(?<letter>[A-G])(?<accidental>[#b]?)$/;
const PITCH_CLASSES = 12;

/**
 * Semitones from C to a spelled pitch in the same octave, so `Cb` is -1 and `B#` is 12.
 *
 * @returns Null when the text isn't a letter A to G with an optional `#` or `b`.
 */
export function semitonesFromC(spelling: string): number | null {
  const groups = SPELLING.exec(spelling)?.groups;
  if (groups?.letter === undefined) return null;
  const accidental = groups.accidental === '#' ? 1 : groups.accidental === 'b' ? -1 : 0;
  return (LETTER_SEMITONES[groups.letter] ?? 0) + accidental;
}

/**
 * The pitch class, 0 (C) to 11 (B), of a spelled pitch.
 *
 * @returns Null when the text isn't a letter A to G with an optional `#` or `b`.
 */
export function pitchClassOf(spelling: string): number | null {
  const semitones = semitonesFromC(spelling);
  return semitones === null ? null : transpose(0, semitones);
}

/** Moves a pitch class by some semitones, wrapping round the octave. */
export function transpose(pitchClass: number, semitones: number): number {
  return (((pitchClass + semitones) % PITCH_CLASSES) + PITCH_CLASSES) % PITCH_CLASSES;
}
