import { expect } from '@playwright/test';
import { scenario, tap, wait } from './kit.ts';

/** Moves the title menu `count` rows, a tick apart so each press registers. */
const move = (action: 'up' | 'down', count: number) =>
  Array.from({ length: count }, () => [tap(action), wait(2)]).flat();
const down = (count: number) => move('down', count);
const up = (count: number) => move('up', count);

/**
 * A fresh save starts on Easy. From the title, the Level button is two rows below Race, under How to Play: each press
 * cycles Easy, Normal, Hard and back to Easy, saving every change. After the full cycle, moving
 * back up to Race and starting a race builds the world on the saved level (Easy; logic's own
 * default is Hard, so a world that shows Easy was given the setting).
 */
export default scenario({
  description: 'the Level button cycles Easy, Normal, Hard, saves each choice, and the next race uses it',
  input: [
    wait(25),
    ...down(2),
    tap('fire'),
    wait(3),
    tap('fire'),
    wait(3),
    tap('fire'),
    wait(3),
    ...up(2),
    tap('fire'),
    wait(25),
    tap('fire'),
    wait(25),
    tap('fire'),
    wait(5),
  ],
  expect({ summary, state, events }) {
    expect(events.filter((e) => e.type === 'settings.changed').map((e) => e.difficulty)).toEqual([
      'normal',
      'hard',
      'easy',
    ]);
    expect(events.filter((e) => e.type === 'save.written')).toHaveLength(4); // three settings changes and the pick that starts the race
    expect(summary).toMatchObject({
      scene: 'race',
      phase: 'countdown',
      difficulty: 'easy',
      raceDifficulty: 'easy',
      levelBanner: { text: 'EASY', pips: 1 },
    });
    expect(state).toMatchObject({ save: { settings: { difficulty: 'easy' } } });
  },
});
