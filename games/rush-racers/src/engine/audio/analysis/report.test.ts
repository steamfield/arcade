import { describe, expect, it } from 'vitest';
import { describeSong } from './report.ts';
import { C_MAJOR, chord, line, testSong } from './test-song.ts';

/** A bar of intro and a two-bar loop with one off-key lead note, a crossing and a wrong bass root. */
const song = testSong({
  title: 'Harbour Dash',
  key: C_MAJOR,
  loopStart: 4,
  bars: 3,
  sections: [
    { name: 'intro', bar: 0 },
    { name: 'A', bar: 1 },
  ],
  chords: [chord('C', 0, 4), chord('G', 4, 4), chord('C', 8, 4)],
  notes: [
    ...line('pulse1', 4, 'B4:1 Bb4:1 G4:2 C5:4'),
    ...line('pulse2', 4, 'D5:1'),
    ...line('triangle', 0, 'C3:4 D3:4 C3:4'),
    ...line('noise', 0, 'k:1 s:1 k:1 s:1'),
  ],
});

describe('describeSong', () => {
  it('reports the form, sections, fit, lead and level under their headings', () => {
    const report = describeSong(song);

    for (const heading of ['Harbour Dash', 'Sections', 'Chord fit', 'Lead', 'Mix', 'Offenders']) {
      expect(report).toContain(heading);
    }
    expect(report).toContain('Key C major, 120 bpm, 4/4');
    expect(report).toContain('Intro 2.0 s, loop 4.0 s (2 bars)');
    expect(report).toMatch(/intro\s+1\s+2\.0 s\s+no\s+C\s+triangle, noise/);
    expect(report).toMatch(/A\s+2\s+4\.0 s\s+yes\s+G C\s+pulse1, pulse2, triangle/);
    expect(report).toMatch(/pulse1\s+4 notes\s+75% on chord\s+75% in key/);
    expect(report).toContain('Bass roots 2 of 3 bars');
    expect(report).toContain('Range 5 semitones, rests 0%, longest run 8 beats, largest leap 5 semitones');
    expect(report).toMatch(/Peak level \d\.\d\d at bar \d+ beat \d+/);
  });

  it('lists the offenders of each kind with bar and beat', () => {
    const report = describeSong(song);

    expect(report).toContain('pulse1 bar 2 beat 2: Bb4 over G');
    expect(report).toContain('bass root bar 2 beat 1: D3 over G');
    expect(report).toContain('crossing bar 2 beat 1');
  });

  it('shows the first ten offenders of a kind and counts the rest', () => {
    const busy = testSong({ bars: 3, key: C_MAJOR, notes: line('pulse1', 0, 'F#5:1 '.repeat(12)) });

    const report = describeSong(busy);

    expect(report).toContain('pulse1 bar 3 beat 2: F#5 over -');
    expect(report).not.toContain('pulse1 bar 3 beat 3');
    expect(report).toContain('and 2 more pulse1');
  });
});
