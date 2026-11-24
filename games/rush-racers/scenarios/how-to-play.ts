import { expect } from '@playwright/test';
import { HOW_TO_PLAY_PAGES } from '../src/engine/screens/how-to-play.ts';
import { scenario, tap, wait } from './kit.ts';

/** A tap followed by a short wait, so the same button pressed twice registers twice. */
const press = (action: 'fire' | 'dash' | 'left' | 'right' | 'down') => [tap(action), wait(3)];

/**
 * From the title, How to Play is two rows below Race, under Friends. After the screen's 20 arming ticks:
 * A, A, B, B walks to page 3, 2, 1; left on the first page stays put; B on the first page leaves.
 * The title comes back with HOW TO PLAY still selected, so A reopens it: A walks to the last page,
 * right on the last page stays put, and A there leaves again.
 */
export default scenario({
  description: 'How to Play pages forward and back, stops at the ends, and returns to the title with it selected',
  input: [
    wait(25),
    ...press('down'),
    ...press('down'),
    tap('fire'),
    wait(25),
    ...press('fire'),
    ...press('fire'),
    ...press('dash'),
    ...press('dash'),
    ...press('left'),
    ...press('dash'),
    wait(25),
    tap('fire'),
    wait(25),
    ...Array.from({ length: HOW_TO_PLAY_PAGES - 1 }, () => press('fire')).flat(),
    ...press('right'),
    ...press('fire'),
    wait(5),
  ],
  expect({ summary, events }) {
    expect(events.filter((e) => e.type === 'howToPlay.page').map((e) => e.page)).toEqual([
      2,
      3,
      2,
      1,
      ...Array.from({ length: HOW_TO_PLAY_PAGES - 1 }, (_, index) => index + 2),
    ]);
    expect(events.filter((e) => e.type === 'scene.started').map((e) => e.scene)).toEqual([
      'title',
      'howToPlay',
      'title',
      'howToPlay',
      'title',
    ]);
    expect(summary).toMatchObject({ scene: 'title', menu: { selected: 2 } });
  },
});
