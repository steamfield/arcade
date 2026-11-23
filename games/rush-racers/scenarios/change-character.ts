import { expect } from '@playwright/test';
import { IDLE_TO_RESULTS, scenario, TITLE_TO_SELECT, tap, wait } from './kit.ts';

/**
 * Races the first race as Gil (title Race, the course in force, one step right on select), idles to a DNF,
 * picks Character on the results screen, keeps the course and finds select on Gil. One step right is Streak, and after select's 20 arming ticks
 * fire races as Streak, so the pick that was current is the one the cursor starts on.
 */
export default scenario({
  description:
    'choosing Character on the results screen opens select on the current pick, and the next race runs as the new one',
  input: [
    ...TITLE_TO_SELECT,
    wait(25),
    tap('right'),
    wait(2),
    tap('fire'),
    wait(IDLE_TO_RESULTS),
    tap('down'),
    tap('fire'),
    wait(25),
    tap('fire'),
    wait(5),
    tap('right'),
    wait(20),
    tap('fire'),
    wait(10),
  ],
  expect({ summary, state, events }) {
    expect(summary).toMatchObject({ scene: 'race', phase: 'countdown', character: 'streak' });
    const { racers } = state as { racers: { id: string; character: string }[] };
    expect(racers.find((racer) => racer.id === 'player')?.character).toBe('streak');
    expect(events.filter((e) => e.type === 'menu.selected').map((e) => e.option)).toEqual(['Race', 'Character']);
    expect(events.filter((e) => e.type === 'scene.started').map((e) => e.scene)).toEqual([
      'title',
      'course',
      'select',
      'race',
      'results',
      'course',
      'select',
      'race',
    ]);
  },
});
