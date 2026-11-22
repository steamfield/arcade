import { expect } from '@playwright/test';
import { hold, scenario, TOP_ROUTE } from './kit.ts';

/**
 * The last route step and the wait for results run as one step, so a single advance()
 * spans the finish, the save and the move to results. The save must still land on the
 * finish tick, before any later tick runs.
 */
export default scenario({
  description: 'finishing the race shows the results with the player placed and timed, after one save',
  start: { scene: 'race' },
  input: [...TOP_ROUTE.slice(0, -1), hold('right', 520 + 90)],
  expect({ summary, events }) {
    const finish = events.find((e) => e.type === 'race.finished');
    expect(summary).toMatchObject({
      scene: 'results',
      menu: { options: ['Race again', 'Title'], selected: 0 },
      result: { place: finish?.playerPlace, ticks: finish?.playerTicks, newBest: true, saveFailed: false },
    });
    expect(finish?.playerTicks).toBeGreaterThan(0);
    const written = events.filter((e) => e.type === 'save.written');
    expect(written).toHaveLength(1);
    expect(written[0]?.tick).toBe(finish?.tick);
    expect(events.map((e) => e.type)).not.toContain('save.failed');
    expect(events.filter((e) => e.type === 'scene.started').map((e) => e.scene)).toEqual(['race', 'results']);
  },
});
