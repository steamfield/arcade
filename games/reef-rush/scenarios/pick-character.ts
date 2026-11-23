import { expect } from '@playwright/test';
import { scenario, tap, wait } from './kit.ts';

/**
 * Title Race opens the select screen on the saved pick (Rudy on a fresh save). Right, right, down
 * moves the cursor Rudy -> Gil -> Streak -> Selene; after the screen's 20 arming ticks, fire races
 * as Selene and saves the pick.
 */
export default scenario({
  description: 'picking a character on the select screen races as that character and saves the pick',
  input: [
    wait(25),
    tap('fire'),
    wait(5),
    tap('right'),
    wait(3),
    tap('right'),
    wait(3),
    tap('down'),
    wait(20),
    tap('fire'),
    wait(10),
  ],
  expect({ summary, state, events }) {
    expect(summary).toMatchObject({ scene: 'race', phase: 'countdown', character: 'selene' });
    const { save, racers } = state as { save: { character: string }; racers: { id: string; character: string }[] };
    expect(save.character).toBe('selene');
    expect(events.filter((e) => e.type === 'save.written')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'scene.started').map((e) => e.scene)).toEqual(['title', 'select', 'race']);
    // The player races as the pick, and the three rivals are three other characters.
    const characters = racers.map((racer) => racer.character);
    expect(racers.find((racer) => racer.id === 'player')?.character).toBe('selene');
    expect(new Set(characters).size).toBe(4);
  },
});
