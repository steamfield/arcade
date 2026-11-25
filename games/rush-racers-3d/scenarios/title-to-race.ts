import { expect } from '@playwright/test';
import { hold, scenario, tap, wait } from './kit.ts';

type Racers = { world: { racers: { id: string; character: string }[] } };

export default scenario({
  description:
    'fire on the title opens select; picking the next character saves it and starts a race against three rivals',
  input: [tap('fire'), wait(2), tap('right'), wait(2), tap('fire'), wait(180), hold('forward', 60)],
  expect({ summary, state, events }) {
    expect(summary).toMatchObject({ scene: 'race', phase: 'racing' });
    const racers = (state as Racers).world.racers;
    expect(racers.map((r) => r.id)).toEqual(['player', 'r1', 'r2', 'r3']);
    expect(racers[0]?.character).toBe('skip');
    const rivals = racers.slice(1).map((r) => r.character);
    expect(new Set(rivals).size).toBe(3);
    expect(rivals).not.toContain('skip');
    expect(events.map((e) => e.type)).toContain('save.written');
  },
});
