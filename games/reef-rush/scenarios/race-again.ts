import { expect } from '@playwright/test';
import { scenario, tap, wait } from './kit.ts';

/** Reaches results the quick way (an idle DNF), waits out the menu's arming ticks, then picks "Race again". */
export default scenario({
  description: 'choosing Race again on the results screen starts a fresh countdown from the start line',
  start: { scene: 'race' },
  input: [wait(1930), tap('kick'), wait(10)],
  expect({ summary, events }) {
    expect(summary).toMatchObject({
      scene: 'race',
      phase: 'countdown',
      place: '1/4',
      finished: false,
      player: { tile: [4, 6] },
    });
    expect((summary as { raceTick: number }).raceTick).toBeLessThan(60);
    expect(events.filter((e) => e.type === 'menu.selected')).toMatchObject([{ option: 'Race again' }]);
    expect(events.filter((e) => e.type === 'scene.started').map((e) => e.scene)).toEqual(['race', 'results', 'race']);
    expect(events.filter((e) => e.type === 'race.countdown').map((e) => e.n)).toEqual([3, 2, 1, 3]);
  },
});
