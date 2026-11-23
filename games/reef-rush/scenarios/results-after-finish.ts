import { expect } from '@playwright/test';
import { HARD_SAVE, hold, scenario, TITLE_TO_RACE, TOP_ROUTE, TOP_ROUTE_LAST_HOLD } from './kit.ts';

/**
 * The last route step and the wait for results run as one step, so a single advance()
 * spans the finish, the save and the move to results. The save must still land on the
 * finish tick, before any later tick runs.
 */
export default scenario({
  description: 'finishing the race shows the results with the player placed and timed, after one save',
  start: { save: HARD_SAVE },
  input: [...TITLE_TO_RACE, ...TOP_ROUTE.slice(0, -1), hold('right', TOP_ROUTE_LAST_HOLD + 90)],
  expect({ summary, events }) {
    const finish = events.find((e) => e.type === 'race.finished');
    expect(summary).toMatchObject({
      scene: 'results',
      menu: { options: ['Race again', 'Title'], selected: 0 },
      result: { place: finish?.playerPlace, ticks: finish?.playerTicks, newBest: true, saveFailed: false },
    });
    expect(finish?.playerTicks).toBeGreaterThan(0);
    // The title and select screens come first (the pick is saved there); count from the race on.
    const raceStart = events.find((e) => e.type === 'race.started')?.tick ?? 0;
    const written = events.filter((e) => e.type === 'save.written' && e.tick >= raceStart);
    expect(written).toHaveLength(1);
    expect(written[0]?.tick).toBe(finish?.tick);
    expect(events.map((e) => e.type)).not.toContain('save.failed');
    // Loading the Hard save restarts the title, then select and the race come before the results.
    expect(events.filter((e) => e.type === 'scene.started').map((e) => e.scene)).toEqual([
      'title',
      'title',
      'select',
      'race',
      'results',
    ]);
  },
});
