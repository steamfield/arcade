import { EventLog, type Stamped } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../logic/events.ts';
import { OCEAN_LEVEL } from '../../logic/level/levels.ts';
import { parseLevel } from '../../logic/level/parse.ts';
import { createWorld } from '../../logic/world.ts';
import type { RuntimeEvent } from '../runtime.ts';
import { createBubbleTracker } from './bubble-tracker.ts';
import type { Bursts } from './bursts.ts';
import { createEventEffects } from './event-effects.ts';

const NO_BURSTS: Bursts = {
  kickPuff() {},
  trailBubble() {},
  coralDebris() {},
  hitSparks() {},
  pearlSparkle() {},
  pickupPop() {},
  inkPuff() {},
  bubblePop() {},
  finishBurst() {},
  placeUp() {},
};

/** Total shake trauma the effects ask for when one tick's `events` arrive. */
function traumaFor(events: GameEvent[]): number {
  const world = createWorld(parseLevel(OCEAN_LEVEL), new EventLog<GameEvent>(), { seed: 1 });
  let trauma = 0;
  const effects = createEventEffects(world, NO_BURSTS, createBubbleTracker(), (amount) => {
    trauma += amount;
  });
  const stamped: Stamped<RuntimeEvent>[] = events.map((event, seq) => ({ ...event, tick: 300, seq }));
  effects.onTick(stamped);
  return trauma;
}

describe('event effects shake', () => {
  it('shakes the screen when a hit lands on the player', () => {
    expect(traumaFor([{ type: 'racer.hit', id: 'player', cause: 'urchin', by: null }])).toBeGreaterThan(0);
  });

  it("doesn't shake for a hit on a rival", () => {
    expect(traumaFor([{ type: 'racer.hit', id: 'tess', cause: 'urchin', by: null }])).toBe(0);
  });

  it('shakes less when a Bubble Shield soaks up the hit than when it lands bare', () => {
    const bare = traumaFor([{ type: 'racer.hit', id: 'player', cause: 'urchin', by: null }]);
    const shielded = traumaFor([
      { type: 'racer.hit', id: 'player', cause: 'urchin', by: null },
      { type: 'shield.popped', id: 'player' },
    ]);
    expect(shielded).toBeGreaterThan(0);
    expect(shielded).toBeLessThan(bare);
  });
});
