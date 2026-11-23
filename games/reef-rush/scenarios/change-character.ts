import { expect } from '@playwright/test';
import { IDLE_TO_RESULTS, scenario, tap, wait } from './kit.ts';

/**
 * Reaches results the quick way (an idle DNF as the default Rudy), moves down to "Character" and picks
 * it. Select opens with its cursor on Rudy; one step right is Gil. After select's 20 arming ticks fire
 * races as Gil, so the second race is not the first one over again.
 */
export default scenario({
  description: 'choosing Character on the results screen opens select, and the next race runs as the new pick',
  start: { scene: 'race' },
  input: [wait(IDLE_TO_RESULTS), tap('down'), tap('fire'), wait(5), tap('right'), wait(20), tap('fire'), wait(10)],
  expect({ summary, state, events }) {
    expect(summary).toMatchObject({ scene: 'race', phase: 'countdown', character: 'gil' });
    const { racers } = state as { racers: { id: string; character: string }[] };
    expect(racers.find((racer) => racer.id === 'player')?.character).toBe('gil');
    expect(events.filter((e) => e.type === 'menu.selected')).toMatchObject([{ option: 'Character' }]);
    expect(events.filter((e) => e.type === 'scene.started').map((e) => e.scene)).toEqual([
      'race',
      'results',
      'select',
      'race',
    ]);
  },
});
