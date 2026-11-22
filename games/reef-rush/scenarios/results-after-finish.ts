import { expect } from '@playwright/test';
import { scenario, TOP_ROUTE, wait } from './kit.ts';

export default scenario({
  description: 'finishing the race shows the results with the player placed and timed, after one save',
  start: { scene: 'race' },
  input: [...TOP_ROUTE, wait(90)],
  expect({ summary, events }) {
    const finish = events.find((e) => e.type === 'race.finished');
    expect(summary).toMatchObject({
      scene: 'results',
      menu: { options: ['Race again', 'Title'], selected: 0 },
      result: { place: finish?.playerPlace, ticks: finish?.playerTicks, newBest: true, saveFailed: false },
    });
    expect(finish?.playerTicks).toBeGreaterThan(0);
    expect(events.filter((e) => e.type === 'save.written')).toHaveLength(1);
    expect(events.map((e) => e.type)).not.toContain('save.failed');
    expect(events.filter((e) => e.type === 'scene.started').map((e) => e.scene)).toEqual(['race', 'results']);
  },
});
