/**
 * How to Play on a Cloudreach course: the pages build from the sky's own art and words (the flight
 * move page, balloons, feathers, the Cloudreach cast) and page through to the last with no error.
 */
import { expect } from '@playwright/test';
import { HOW_TO_PLAY_PAGES } from '../src/engine/how-to-play.ts';
import { scenario, tap, wait } from './kit.ts';

/** A tap followed by a short wait, so the same button pressed twice registers twice. */
const press = (action: 'fire' | 'down') => [tap(action), wait(3)];

/**
 * `?course=thunderhead-pass` makes Thunderhead Pass the course in force, so How to Play teaches its
 * medium, flight, in its world's words. From the title, How to Play is two rows below Race (past
 * Friends); after the screen's 20 arming ticks, A walks one page forward at a time to the last. The
 * game fixture fails the run on any console or game error while a page builds or shows.
 */
export default scenario({
  description: "How to Play on Thunderhead Pass shows Cloudreach's flight pages, every one of them",
  start: { query: { course: 'thunderhead-pass' } },
  input: [
    wait(25),
    ...press('down'),
    ...press('down'),
    tap('fire'),
    wait(25),
    ...Array.from({ length: HOW_TO_PLAY_PAGES - 1 }, () => press('fire')).flat(),
    wait(5),
  ],
  expect({ summary, events }) {
    expect(summary).toMatchObject({
      scene: 'howToPlay',
      course: 'thunderhead-pass',
      medium: 'flight',
      howToPlay: { page: HOW_TO_PLAY_PAGES, pages: HOW_TO_PLAY_PAGES },
    });
    expect(events.filter((e) => e.type === 'howToPlay.page').map((e) => e.page)).toEqual(
      Array.from({ length: HOW_TO_PLAY_PAGES - 1 }, (_, index) => index + 2),
    );
  },
});
