import { expect } from '@playwright/test';
import { scenario, tap, wait } from './kit.ts';

/**
 * `?scene=jukebox` opens the sound test on the first song. Down moves to the second, and after the
 * screen's 20 arming ticks fire auditions it: the song is heard (`audio.played`) and the summary
 * names it as playing, with the cursor still on it.
 */
export default scenario({
  description: 'the sound test plays the highlighted song on fire',
  start: { scene: 'jukebox' },
  input: [wait(25), tap('down'), wait(3), tap('fire'), wait(10)],
  expect({ summary, events }) {
    const jukebox = summary.jukebox as { selected: string; playing: string | null; tracks: string[] };
    const second = jukebox.tracks[1];
    const songsPlayed = events
      .filter((e) => e.type === 'audio.played' && e.kind === 'song' && !String(e.key).includes(':'))
      .map((e) => e.key);

    expect(summary.scene).toBe('jukebox');
    expect(jukebox).toMatchObject({ selected: second, playing: second });
    expect(songsPlayed).toEqual([second]);
  },
});
