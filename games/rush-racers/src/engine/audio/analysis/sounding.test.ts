import { describe, expect, it } from 'vitest';
import { isSoundingAt, pitchedNotes, soundingPitches } from './sounding.ts';
import { line, midi, testSong } from './test-song.ts';

describe('sounding', () => {
  it('keeps a channel’s pitched notes in start order, leaving out drops', () => {
    const song = testSong({
      bars: 1,
      notes: [
        ...line('triangle', 2, 'G2:2'),
        ...line('triangle', 0, 'C2:1', { drop: true }),
        ...line('triangle', 1, 'E2:1'),
      ],
    });

    expect(pitchedNotes(song, 'triangle').map((note) => note.pitch)).toEqual([midi('E2'), midi('G2')]);
    expect(pitchedNotes(testSong({ bars: 1, notes: line('noise', 0, 'k:1') }), 'noise')).toEqual([]);
  });

  it('sounds each distinct arpeggio pitch once', () => {
    const [note] = pitchedNotes(
      testSong({ bars: 1, notes: line('pulse1', 0, 'C5:1', { arp: [0, 4, 7, 4] }) }),
      'pulse1',
    );

    expect(note && soundingPitches(note)).toEqual([midi('C5'), midi('E5'), midi('G5')]);
  });

  it('holds a note from its start up to, but not at, its end', () => {
    const [note] = line('pulse1', 1, 'C5:2');

    expect([0.5, 1, 2.9, 3].map((beat) => note !== undefined && isSoundingAt(note, beat))).toEqual([
      false,
      true,
      true,
      false,
    ]);
  });
});
