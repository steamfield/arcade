import { expect } from '@playwright/test';
import { HARD_SAVE, hold, scenario, TITLE_TO_RACE, wait } from './kit.ts';

/**
 * The `surface` stage stands the player 3 tiles under the sea's surface with sky straight above.
 * Swimming up with a dash carries them out of the water: they breach, gravity turns them over and
 * they splash back in.
 */
export default scenario({
  description: 'swimming up hard through the surface breaches into the air and splashes back down',
  start: { save: HARD_SAVE, seed: 1, query: { stage: 'surface' } },
  input: [...TITLE_TO_RACE, wait(180), hold(['up', 'dash'], 1), hold('up', 40), wait(90)],
  expect({ events }) {
    const player = events.filter(
      (e) => (e.type === 'racer.breached' || e.type === 'racer.splashed') && e.id === 'player',
    );
    expect(player.map((e) => e.type)).toEqual(['racer.breached', 'racer.splashed']);
  },
});
