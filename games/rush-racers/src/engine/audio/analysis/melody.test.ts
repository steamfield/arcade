import { describe, expect, it } from 'vitest';
import { leadFacts, motifStatements, sectionSimilarity } from './melody.ts';
import { line, testSong } from './test-song.ts';

describe('leadFacts', () => {
  // One bar of intro, then a three-bar loop: 7 of its 12 beats sound and the longest run is 4.
  const song = testSong({
    bars: 4,
    loopStart: 4,
    notes: [
      ...line('pulse1', 0, 'C6:4 C5:1 E5:1 G5:2 .:2 D5:1 A5:1 F5:1 .:3'),
      ...line('pulse2', 5, 'G5:1 B4:1 .:1 C6:1'),
    ],
  });

  it('measures the range, rests and leaps of the lead across the loop only', () => {
    const facts = leadFacts(song);

    expect(facts.range).toBe(9);
    expect(facts.restShare).toBeCloseTo(5 / 12);
    expect(facts.longestUnbrokenBeats).toBe(4);
    expect(facts.maxLeap).toBe(7);
  });

  it('finds a second-pulse note that starts above a sounding lead note', () => {
    expect(leadFacts(song).crossings).toEqual([{ bar: 2, beat: 2 }]);
  });
});

describe('motifStatements', () => {
  // Bar 1 is the motif, bar 2 repeats it, bar 3 transposes it, bar 4 keeps only its rhythm.
  const song = testSong({
    bars: 4,
    notes: line('pulse1', 0, 'C5:1 D5:1 E5:2 C5:1 D5:1 E5:2 G5:1 A5:1 B5:2 E5:1 C5:1 G5:2'),
  });
  const motif = { fromBar: 0, bars: 1 };

  it('counts exact statements, the original included', () => {
    expect(motifStatements(song, motif, 'exact')).toBe(2);
  });

  it('counts statements of the rhythm whatever the pitches', () => {
    expect(motifStatements(song, motif, 'rhythm')).toBe(4);
  });

  it('counts statements of the rhythm and intervals at any transposition', () => {
    expect(motifStatements(song, motif, 'transposed')).toBe(3);
  });
});

describe('sectionSimilarity', () => {
  const song = testSong({
    bars: 3,
    sections: [
      { name: 'A', bar: 0 },
      { name: "A'", bar: 1 },
      { name: 'pad', bar: 2 },
    ],
    notes: [
      ...line('pulse1', 0, 'C5:1 D5:1 E5:2 C5:1 D5:1 F5:2'),
      ...line('noise', 0, 'k:1 s:1 k:1 s:1 k:1 s:1 k:1 s:1'),
      ...line('triangle', 8, 'C3:2 G2:2'),
    ],
  });

  it('scores a section against itself as 1', () => {
    expect(sectionSimilarity(song, 'A', 'A')).toBe(1);
  });

  it('scores a section with one changed pitch below 1, crediting the shared rhythm', () => {
    // Every onset matches (1) and six of eight distinct pitched onsets do (0.75): the mean is 0.875.
    expect(sectionSimilarity(song, 'A', "A'")).toBeCloseTo(0.875);
  });

  it('scores sections that share nothing as 0', () => {
    expect(sectionSimilarity(song, 'A', 'pad')).toBe(0);
  });

  it('names the sections the song has when asked for one it lacks', () => {
    expect(() => sectionSimilarity(song, 'A', 'chorus')).toThrow(/no section "chorus".*A, A', pad/);
  });
});
