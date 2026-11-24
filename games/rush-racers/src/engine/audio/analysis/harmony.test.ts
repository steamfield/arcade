import { describe, expect, it } from 'vitest';
import { bassRoots, chordFit } from './harmony.ts';
import { C_MAJOR, chord, line, midi, testSong } from './test-song.ts';

/** Bar 1 over C, bar 2 over G, in C major: F#5 and Bb4 are neither chord tones nor in the key. */
const twoBars = testSong({
  bars: 2,
  key: C_MAJOR,
  chords: [chord('C', 0, 4), chord('G', 4, 4)],
  notes: line('pulse1', 0, 'C5:1 D5:1 F#5:1 E5:1 B4:1 C5:1 Bb4:1 G4:1'),
});

describe('chordFit', () => {
  it('counts chord tones, key tones and the notes that are neither', () => {
    expect(chordFit(twoBars, 'pulse1')).toEqual({
      notes: 8,
      onChord: 4,
      inKey: 6,
      offenders: [
        { bar: 1, beat: 3, pitch: midi('F#5'), chord: 'C' },
        { bar: 2, beat: 3, pitch: midi('Bb4'), chord: 'G' },
      ],
    });
  });

  it('counts only notes on beats one and three when asked for strong beats', () => {
    expect(chordFit(twoBars, 'pulse1', { strongBeatsOnly: true })).toEqual({
      notes: 4,
      onChord: 2,
      inKey: 2,
      offenders: [
        { bar: 1, beat: 3, pitch: midi('F#5'), chord: 'C' },
        { bar: 2, beat: 3, pitch: midi('Bb4'), chord: 'G' },
      ],
    });
  });

  it('counts each arpeggio offset as a sounding pitch and skips drop notes', () => {
    const song = testSong({
      bars: 1,
      key: C_MAJOR,
      chords: [chord('C', 0, 4)],
      notes: [
        ...line('pulse2', 0, 'C5:4', { arp: [0, 4, 6] }),
        ...line('triangle', 0, 'C2:1 F#3:1', { drop: true }),
        ...line('triangle', 2, 'C3:2'),
      ],
    });

    expect(chordFit(song, 'pulse2')).toEqual({
      notes: 3,
      onChord: 2,
      inKey: 2,
      offenders: [{ bar: 1, beat: 1, pitch: midi('F#5'), chord: 'C' }],
    });
    expect(chordFit(song, 'triangle')).toEqual({ notes: 1, onChord: 1, inKey: 1, offenders: [] });
  });

  it('judges a song without a chart against its key alone', () => {
    const song = testSong({ bars: 1, key: C_MAJOR, notes: line('pulse1', 0, 'C5:2 F#5:2') });

    expect(chordFit(song, 'pulse1')).toEqual({
      notes: 2,
      onChord: 0,
      inKey: 1,
      offenders: [{ bar: 1, beat: 3, pitch: midi('F#5'), chord: null }],
    });
  });

  it('counts the notes of a song with neither chart nor key and finds no offenders', () => {
    const song = testSong({ bars: 1, notes: line('pulse1', 0, 'C5:2 F#5:2') });

    expect(chordFit(song, 'pulse1')).toEqual({ notes: 2, onChord: 0, inKey: 0, offenders: [] });
  });

  it('refuses the noise channel, which has no pitches', () => {
    expect(() => chordFit(twoBars, 'noise')).toThrow(/noise.*pulse1, pulse2 or triangle/);
  });
});

describe('bassRoots', () => {
  it("checks the first bass note of each charted bar against the chord's root", () => {
    const song = testSong({
      bars: 4,
      chords: [chord('C', 0, 4), chord('G', 4, 4), chord('Am', 8, 4)],
      notes: [
        ...line('triangle', 0, 'A1:1', { drop: true }),
        ...line('triangle', 1, 'C3:3 D3:2 G2:2'),
        ...line('triangle', 12, 'F2:4'),
      ],
    });

    // Bar 3 is charted but the bass rests through it, so it is left out rather than missed.
    expect(bassRoots(song)).toEqual({
      bars: 2,
      rootOnDownbeat: 1,
      offenders: [{ bar: 2, beat: 1, pitch: midi('D3'), chord: 'G' }],
    });
  });

  it('judges a bass note held over the bar line at the next downbeat', () => {
    const held = testSong({ bars: 2, chords: [chord('C', 0, 8)], notes: line('triangle', 0, 'C2:8') });
    const heldIntoG = testSong({
      bars: 2,
      chords: [chord('C', 0, 4), chord('G', 4, 4)],
      notes: line('triangle', 0, 'C2:8'),
    });

    expect(bassRoots(held)).toEqual({ bars: 2, rootOnDownbeat: 2, offenders: [] });
    expect(bassRoots(heldIntoG)).toEqual({
      bars: 2,
      rootOnDownbeat: 1,
      offenders: [{ bar: 2, beat: 1, pitch: midi('C2'), chord: 'G' }],
    });
  });

  it('judges a bass entry against the chord under it, not the downbeat chord', () => {
    const song = testSong({
      bars: 1,
      chords: [chord('Am', 0, 2), chord('F', 2, 2)],
      notes: line('triangle', 2, 'F2:2'),
    });

    expect(bassRoots(song)).toEqual({ bars: 1, rootOnDownbeat: 1, offenders: [] });
  });
});
