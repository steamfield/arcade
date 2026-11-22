import { expect } from '@playwright/test';
import { scenario, TOP_ROUTE } from './kit.ts';

/**
 * Swims the whole course on the default seed. Rivals fire Homing Squids at any racer ahead of them,
 * so over a full race at least one squid should lock on to the player; the HUD's lock-on arrow and
 * its KICK! prompt read the same squid state and events this asserts on: a lock-on names the
 * player before any squid latches them, and the player never shakes off more squids than latched
 * on.
 *
 * `todo` until lane 7/a's squids fire: against the phase 7 scaffold's no-op logic nothing is ever
 * fired, so there is no lock-on to see. Once 7/a is merged this should pass as written; drop `todo`
 * then. If the default seed's route never draws a squid, pick the seed 7/a's report names. The
 * HUD's own drawing is checked in `arcade see` captures (UI.md, "Attack power-ups"), not here.
 */
export default scenario({
  description: 'a squid that locks on the player is announced before it latches, and the latch ends',
  todo: true,
  start: { scene: 'race', seed: 1 },
  input: TOP_ROUTE,
  expect({ events }) {
    const locks = events.filter((e) => e.type === 'squid.locked' && e.target === 'player');
    expect(locks.length, 'a rival should lock a squid on the player at least once').toBeGreaterThan(0);

    const firstLock = locks[0]?.tick ?? Number.POSITIVE_INFINITY;
    const latches = events.filter((e) => e.type === 'squid.latched' && e.id === 'player');
    for (const latch of latches) expect(latch.tick).toBeGreaterThanOrEqual(firstLock);
    if (latches.length > 0) {
      const ends = events.filter((e) => e.type === 'racer.shaken' && e.id === 'player').length;
      expect(ends, 'a latch ends by kicks or by running out; kicks are reported as racer.shaken').toBeLessThanOrEqual(
        latches.length,
      );
    }
  },
});
