import { expect } from '@playwright/test';
import { scenario, tap, wait } from './kit.ts';

/**
 * From the title, How to Play is two rows below Race. Pages turn with A (next) and B (back); the
 * screen ignores presses for its first 20 ticks like every menu. Next, next, back, back, back
 * walks to page 3, then 2, then 1, and the last back leaves the first page for the title.
 */
export default scenario({
  description: 'How to Play opens from the title, pages forward and back, and B on the first page returns to the title',
  input: [
    wait(25),
    tap('down'),
    wait(2),
    tap('down'),
    wait(2),
    tap('kick'),
    wait(25),
    tap('kick'),
    wait(3),
    tap('kick'),
    wait(3),
    tap('burst'),
    wait(3),
    tap('burst'),
    wait(3),
    tap('burst'),
    wait(5),
  ],
  expect({ summary, events }) {
    expect(summary).toMatchObject({ scene: 'title' });
    expect(events.filter((e) => e.type === 'scene.started').map((e) => e.scene)).toEqual([
      'title',
      'howToPlay',
      'title',
    ]);
    expect(events.filter((e) => e.type === 'menu.selected')).toMatchObject([{ option: 'How to play' }]);
  },
});
