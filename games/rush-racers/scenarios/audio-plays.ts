import { expect } from '@playwright/test';
import { scenario, wait } from './kit.ts';

/**
 * The harness starts the game by clicking the start gate, a real gesture, so the AudioContext
 * is running in headless Chromium just as it is for a player. Section changes inside a song
 * follow the audio clock, which runs on wall time rather than ticks, so they are left out.
 */
export default scenario({
  description: 'the countdown beeps and GO sound, and the race theme starts on GO, once each',
  start: { scene: 'race' },
  input: [wait(200)],
  expect({ events }) {
    const countdownTicks = events.filter((e) => e.type === 'race.countdown').map((e) => e.tick);
    const startTick = events.find((e) => e.type === 'race.started')?.tick;
    const played = events
      .filter((e) => e.type === 'audio.played' && !String(e.key).includes(':'))
      .map(({ key, kind, tick }) => ({ key, kind, tick }));

    expect(countdownTicks).toEqual([0, 60, 120]);
    expect(startTick).toBe(180);
    expect(played).toEqual([
      { key: 'countdown', kind: 'sfx', tick: 0 },
      { key: 'countdown', kind: 'sfx', tick: 60 },
      { key: 'countdown', kind: 'sfx', tick: 120 },
      { key: 'go', kind: 'sfx', tick: 180 },
      { key: 'race', kind: 'song', tick: 180 },
    ]);
  },
});
