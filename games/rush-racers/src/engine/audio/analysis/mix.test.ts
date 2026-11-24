import { describe, expect, it } from 'vitest';
import { peakLevel } from './mix.ts';
import { line, testSong } from './test-song.ts';

describe('peakLevel', () => {
  it('picks the instant where the most voices sound together, counting held notes', () => {
    // Levels: pulse1 0.5, pulse2 0.4, triangle 0.6, noise 0.3. At bar 2 beat 3 the held bass,
    // a new lead note, a half-velocity pulse2 note and a kick sound: 0.5 + 0.2 + 0.6 + 0.3.
    const song = testSong({
      bars: 2,
      notes: [
        ...line('pulse1', 0, 'C5:4 E5:2 G5:2'),
        ...line('triangle', 4, 'C3:4'),
        ...line('pulse2', 6, 'E4:2', { velocity: 0.5 }),
        ...line('noise', 6, 'k:1'),
      ],
    });

    const peak = peakLevel(song);

    expect(peak.level).toBeCloseTo(1.6);
    expect({ bar: peak.bar, beat: peak.beat }).toEqual({ bar: 2, beat: 3 });
  });
});
