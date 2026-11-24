import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { DEFAULT_COURSE } from '../../logic/courses/index.ts';
import type { GameEvent } from '../../logic/events.ts';
import { createWorld } from '../../logic/world.ts';
import { createBubbleTracker } from './bubble-tracker.ts';
import type { Bursts } from './bursts.ts';
import { createEventEffects } from './event-effects.ts';

const NO_BURSTS: Bursts = {
  kickPuff() {},
  trailBubble() {},
  coralDebris() {},
  pearlSparkle() {},
  pickupPop() {},
  inkPuff() {},
  bubblePop() {},
  finishBurst() {},
  placeUp() {},
};

describe('event effects at the surface', () => {
  it.each(['racer.breached', 'racer.splashed'] as const)('throws droplets from the racer on %s', (type) => {
    const world = createWorld(DEFAULT_COURSE, new EventLog<GameEvent>(), { seed: 1 });
    const seen: string[] = [];
    const bursts: Bursts = { ...NO_BURSTS, bubblePop: (x, y) => seen.push(`pop ${x},${y}`) };
    const effects = createEventEffects(world, bursts, createBubbleTracker(), () => {});
    const tess = world.racers.find((racer) => racer.id === 'tess');
    if (!tess) throw new Error('No racer tess on the default course');

    effects.onTick([{ type, id: 'tess', tick: 300, seq: 0 }]);

    expect(seen).toEqual([`pop ${tess.body.x + tess.body.w / 2},${tess.body.y + tess.body.h / 2}`]);
  });
});
