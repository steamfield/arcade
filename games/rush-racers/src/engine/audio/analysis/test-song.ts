/**
 * Hand-built songs for the analysis tests. Builds `Song` values directly, so the tests don't
 * depend on the parser.
 */
import type { Channel, ChannelVoice, ChordSpan, Drum, NoteEvent, Song, SongKey } from '../notation.ts';

const LETTER_CLASSES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const DRUM_LETTERS: Record<string, Drum> = { k: 'kick', s: 'snare', h: 'hat', o: 'openHat', c: 'crash', t: 'tom' };
const NOTE_NAME = /^(?<letter>[A-G])(?<accidental>[#b]?)(?<octave>-?\d)$/;

/** Chord symbols the tests use, as root and pitch classes. */
const CHORD_TONES: Record<string, { root: number; tones: number[] }> = {
  C: { root: 0, tones: [0, 4, 7] },
  Dm: { root: 2, tones: [2, 5, 9] },
  F: { root: 5, tones: [5, 9, 0] },
  G: { root: 7, tones: [7, 11, 2] },
  G7: { root: 7, tones: [7, 11, 2, 5] },
  Am: { root: 9, tones: [9, 0, 4] },
};

/** C major, for songs that declare a key. */
export const C_MAJOR: SongKey = { tonic: 0, mode: 'major', scale: [0, 2, 4, 5, 7, 9, 11] };

/**
 * The MIDI number of a note name such as `C4` (60), `F#5` or `Bb3`.
 *
 * @throws {Error} When the name isn't a letter, optional `#` or `b`, and an octave digit.
 */
export function midi(name: string): number {
  const groups = NOTE_NAME.exec(name)?.groups;
  if (!groups) throw new Error(`Bad note name "${name}": write a letter, optional # or b, and an octave, like F#4.`);
  const accidental = groups.accidental === '#' ? 1 : groups.accidental === 'b' ? -1 : 0;
  return 12 * (Number(groups.octave) + 1) + (LETTER_CLASSES[groups.letter ?? 'C'] ?? 0) + accidental;
}

/**
 * Notes for one channel from `startBeat`, written as space-separated `pitch:beats` tokens: a note
 * name (`E5:1`), a drum letter (`k:0.5`) or a rest (`.:2`). `extra` is merged into every note.
 *
 * @throws {Error} When a token has no `:beats` part or its pitch is neither a note nor a drum.
 */
export function line(channel: Channel, startBeat: number, spec: string, extra: Partial<NoteEvent> = {}): NoteEvent[] {
  const notes: NoteEvent[] = [];
  let beat = startBeat;
  for (const token of spec.trim().split(/\s+/)) {
    const [pitchText, lengthText] = token.split(':');
    if (pitchText === undefined || lengthText === undefined)
      throw new Error(`Bad token "${token}": write pitch:beats.`);
    const length = Number(lengthText);
    if (pitchText !== '.') {
      const pitch = DRUM_LETTERS[pitchText] ?? midi(pitchText);
      notes.push({ channel, start: beat, length, pitch, velocity: 1, ...extra });
    }
    beat += length;
  }
  return notes;
}

/**
 * A chord chart span for one of the symbols in `CHORD_TONES`.
 *
 * @throws {Error} When the symbol isn't in the table.
 */
export function chord(symbol: string, start: number, length: number): ChordSpan {
  const shape = CHORD_TONES[symbol];
  if (!shape)
    throw new Error(`No chord "${symbol}" in the test table; use one of ${Object.keys(CHORD_TONES).join(', ')}.`);
  return { start, length, symbol, root: shape.root, tones: shape.tones };
}

/** What a test song needs; everything else has a default. */
export interface TestSongSpec extends Partial<Omit<Song, 'lengthBeats'>> {
  bars: number;
  notes: NoteEvent[];
}

function voice(level: number): ChannelVoice {
  return { envelope: { attack: 0, decay: 0, sustain: 1, release: 0 }, level };
}

/** A 4/4 song at 120 bpm (two seconds a bar) of `bars` bars, overridden by `spec`. */
export function testSong(spec: TestSongSpec): Song {
  const { bars, ...rest } = spec;
  const beatsPerBar = spec.beatsPerBar ?? 4;
  return {
    name: 'test',
    title: 'Test Song',
    key: null,
    chords: [],
    bpm: 120,
    loopStart: null,
    sections: [],
    voices: { pulse1: voice(0.5), pulse2: voice(0.4), triangle: voice(0.6), noise: voice(0.3) },
    ...rest,
    beatsPerBar,
    meter: `${beatsPerBar}/4`,
    lengthBeats: bars * beatsPerBar,
  };
}
