import { expect } from '@playwright/test';
import { scenario, tap, wait } from './kit.ts';

/** Moves the title menu down `count` rows, a tick apart so each press registers: Sound is three below Race, Motion one more. */
const down = (count: number) => Array.from({ length: count }, () => [tap('down'), wait(2)]).flat();

/**
 * From the title, choosing Sound mutes and choosing Motion turns reduced motion on (a fresh save
 * follows the OS, which is full motion under test). Each choice is saved, so a reload keeps it.
 */
export default scenario({
  description: 'the title menu toggles sound and motion and saves both',
  input: [wait(25), ...down(3), tap('kick'), wait(5), tap('down'), tap('kick'), wait(5)],
  expect({ state, events }) {
    expect(events.filter((e) => e.type === 'settings.changed')).toMatchObject([
      { muted: true, reducedMotion: false },
      { muted: true, reducedMotion: true },
    ]);
    expect(events.filter((e) => e.type === 'save.written')).toHaveLength(2);
    expect(state).toMatchObject({
      scene: 'title',
      settings: { muted: true, reducedMotion: true },
      save: { settings: { muted: true, reducedMotion: true } },
    });
  },
});
