import { expect } from '@playwright/test';
import { HARD_SAVE, hold, scenario, TITLE_TO_RACE, TOP_ROUTE, TOP_ROUTE_LAST_HOLD, tap, wait } from './kit.ts';

/**
 * The last route step and the wait for results run as one step, so a single advance()
 * spans the finish, the save and the move to results. The save must still land on the
 * finish tick, before any later tick runs.
 *
 * The results screen comes up about 60 ticks after the route ends. The fire press 64 ticks
 * after it, as a player still mashing fire from the race would press it, must not pick a
 * menu option before the results have been seen.
 */
export default scenario({
  description:
    'finishing the race shows the results with the player placed and timed, after one save, and ignores a fire press in their first moments',
  start: { save: HARD_SAVE },
  // Swims the whole course, about 250 input steps.
  slow: true,
  input: [...TITLE_TO_RACE, ...TOP_ROUTE.slice(0, -1), hold('right', TOP_ROUTE_LAST_HOLD + 64), tap('fire'), wait(25)],
  expect({ summary, events }) {
    const finish = events.find((e) => e.type === 'race.finished');
    expect(summary).toMatchObject({
      scene: 'results',
      menu: { options: ['Race again', 'Character', 'Title'], selected: 0 },
      result: { place: finish?.playerPlace, ticks: finish?.playerTicks, newBest: true, saveFailed: false },
    });
    expect(finish?.playerTicks).toBeGreaterThan(0);
    // The title and select screens come first (the pick is saved there); count from the race on.
    const raceStart = events.find((e) => e.type === 'race.started')?.tick ?? 0;
    const written = events.filter((e) => e.type === 'save.written' && e.tick >= raceStart);
    expect(written).toHaveLength(1);
    expect(written[0]?.tick).toBe(finish?.tick);
    expect(events.map((e) => e.type)).not.toContain('save.failed');
    // The title and select presses before the race are menu picks too; only the results screen counts.
    expect(events.filter((e) => e.tick >= (finish?.tick ?? 0)).map((e) => e.type)).not.toContain('menu.selected');
    // Loading the Hard save restarts the title, then course select, select and the race come before the results.
    expect(events.filter((e) => e.type === 'scene.started').map((e) => e.scene)).toEqual([
      'title',
      'title',
      'course',
      'select',
      'race',
      'results',
    ]);
  },
});
