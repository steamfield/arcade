import { describe, expect, it } from 'vitest';
import { line, testSong } from './test-song.ts';
import { isStrongBeat, positionOf, sectionSpan } from './timeline.ts';

describe('timeline', () => {
  it('places a beat as a 1-based bar and beat, fractional between beats', () => {
    const song = testSong({ bars: 4, notes: [] });

    expect(positionOf(song, 0)).toEqual({ bar: 1, beat: 1 });
    expect(positionOf(song, 5.5)).toEqual({ bar: 2, beat: 2.5 });
    expect(positionOf(song, 1 / 3 + 1 / 3 + 1 / 3 + 3)).toEqual({ bar: 2, beat: 1 });
  });

  it('counts beat three as strong in bars of four and not in bars of three', () => {
    const common = testSong({ bars: 2, notes: [] });
    const waltz = testSong({ bars: 2, beatsPerBar: 3, notes: [] });

    expect([0, 1, 2, 3, 4].map((beat) => isStrongBeat(common, beat))).toEqual([true, false, true, false, true]);
    expect([0, 1, 2, 3].map((beat) => isStrongBeat(waltz, beat))).toEqual([true, false, false, true]);
  });

  it('gives a section the beats up to the next one and the last up to the end', () => {
    const song = testSong({
      bars: 5,
      sections: [
        { name: 'A', bar: 0 },
        { name: 'B', bar: 2 },
      ],
      notes: line('pulse1', 0, 'C5:20'),
    });

    expect(sectionSpan(song, 'B')).toEqual({ name: 'B', from: 8, to: 20 });
    expect(() => sectionSpan(song, 'C')).toThrow('Song "test" has no section "C"; its sections are A, B.');
  });
});
