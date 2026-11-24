import { describe, expect, it } from 'vitest';
import { formOf } from './form.ts';
import { line, testSong } from './test-song.ts';

describe('formOf', () => {
  it('splits a looping song into intro and loop seconds with each section placed', () => {
    const song = testSong({
      bars: 10,
      loopStart: 8,
      sections: [
        { name: 'intro', bar: 0 },
        { name: 'A', bar: 2 },
        { name: 'B', bar: 6 },
      ],
      notes: line('pulse1', 0, 'C5:40'),
    });

    expect(formOf(song)).toEqual({
      introSeconds: 4,
      loopSeconds: 16,
      loopBars: 8,
      sections: [
        { name: 'intro', bars: 2, seconds: 4, inLoop: false },
        { name: 'A', bars: 4, seconds: 8, inLoop: true },
        { name: 'B', bars: 4, seconds: 8, inLoop: true },
      ],
    });
  });

  it('treats the whole of a one-shot as its loop', () => {
    const song = testSong({ bars: 3, notes: line('pulse1', 0, 'C5:12') });

    expect(formOf(song)).toEqual({ introSeconds: 0, loopSeconds: 6, loopBars: 3, sections: [] });
  });
});
