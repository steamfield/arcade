import { EventLog, type Stamped } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { DEFAULT_COURSE } from '../../logic/courses/index.ts';
import type { GameEvent } from '../../logic/events.ts';
import { raceOn } from '../../logic/test-world.ts';
import { RACER_SIZE } from '../../logic/types.ts';
import { createWorld } from '../../logic/world.ts';
import type { RuntimeEvent } from '../runtime.ts';
import type { CameraSpan } from '../view/storm-reach.ts';
import { createBubbleTracker } from './bubble-tracker.ts';
import type { Bursts } from './bursts.ts';
import { createEventEffects } from './event-effects.ts';

/** A camera showing the level's first 320 px. */
const SCREEN: CameraSpan = { x: 0, y: 0, width: 320 };

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
  const world = createWorld(DEFAULT_COURSE, new EventLog<GameEvent>(), { seed: 1 });
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

describe('event effects for the attack power-ups', () => {
  /** Effects over a fresh world with every burst recorded as `name x,y`. */
  function setup() {
    const world = createWorld(DEFAULT_COURSE, new EventLog<GameEvent>(), { seed: 1 });
    const seen: string[] = [];
    const record = (name: string) => (x: number, y: number) => seen.push(`${name} ${x},${y}`);
    const bursts: Bursts = {
      ...NO_BURSTS,
      inkPuff: record('ink'),
      bubblePop: record('pop'),
      trailBubble: record('trail'),
    };
    const effects = createEventEffects(world, bursts, createBubbleTracker(), () => {});
    const drain = (events: GameEvent[]) =>
      effects.onTick(events.map((event, seq) => ({ ...event, tick: 300, seq }) as Stamped<RuntimeEvent>));
    return { world, seen, drain };
  }

  it('puffs ink where a squid was when it fizzles, picking the right one when two are out', () => {
    const { world, seen, drain } = setup();
    const squid = (x: number, owner: 'tess' | 'bo') => ({ x, y: 50, vx: 0, vy: 0, ttl: 9, owner, target: null });
    const first = squid(100, 'tess');
    const second = squid(200, 'bo');
    world.squids.push(first, second);
    drain([]);
    // Both move on, then tess's squid is gone.
    first.x = 110;
    second.x = 210;
    drain([]);
    world.squids.splice(0, 1);
    drain([{ type: 'squid.lost', owner: 'tess' }]);
    expect(seen).toEqual(['ink 110,50']);
  });

  it('pops a bubble burst where a decoy was when it is popped', () => {
    const { world, seen, drain } = setup();
    world.decoys.push({ x: 300, y: 60, vx: 0, vy: 0, ttl: 5, owner: 'squib' });
    drain([]);
    world.decoys.length = 0;
    drain([{ type: 'decoy.popped', owner: 'squib', by: 'player' }]);
    expect(seen).toEqual(['pop 300,60']);
  });
});

describe('event effects for the sky set pieces', () => {
  /**
   * Effects over a course with a ring at column 9 and storm zones over columns 5-7 (on `SCREEN`) and
   * 22-23 (past its right edge), with every burst recorded as `name x,y` and the shake summed.
   */
  function setup() {
    const { world } = raceOn({
      name: 'sky',
      ascii: `
        ##########################
        #1.......@..............F#
        #2......................F#
        #3......................F#
        #4......................F#
        ##########################
      `,
      lightning: [
        { cols: [5, 7], periodTicks: 150, offsetTicks: 0 },
        { cols: [22, 23], periodTicks: 150, offsetTicks: 0 },
      ],
    });
    const seen: string[] = [];
    const record = (name: string) => (x: number, y: number) => seen.push(`${name} ${x},${y}`);
    const bursts: Bursts = { ...NO_BURSTS, bubblePop: record('pop'), pearlSparkle: record('sparkle') };
    let trauma = 0;
    const effects = createEventEffects(
      world,
      bursts,
      createBubbleTracker(),
      (amount) => {
        trauma += amount;
      },
      () => SCREEN,
    );
    const drain = (events: GameEvent[]) =>
      effects.onTick(events.map((event, seq) => ({ ...event, tick: 300, seq }) as Stamped<RuntimeEvent>));
    return { world, seen, drain, trauma: () => trauma };
  }

  it("puffs under a racer's feet when it bounces", () => {
    const { world, seen, drain } = setup();
    const tess = world.racers.find((racer) => racer.id === 'tess');
    if (!tess) throw new Error('No tess on the grid');
    tess.body.x = 100;
    tess.body.y = 40;
    drain([{ type: 'racer.bounced', id: 'tess' }]);
    expect(seen).toEqual([`pop ${100 + tess.body.w / 2},${40 + tess.body.h / 2 + RACER_SIZE.height / 2}`]);
  });

  it("sparkles at the ring the player passes, and not at a rival's pass", () => {
    const { seen, drain } = setup();
    drain([
      { type: 'ring.passed', id: 'tess', ring: 0 },
      { type: 'ring.passed', id: 'player', ring: 0 },
    ]);
    // The ring is at tile (9, 1): centre (152, 24).
    expect(seen).toEqual(['sparkle 152,24']);
  });

  it('shakes for a strike on screen and not for one past its edge', () => {
    const onScreen = setup();
    onScreen.drain([{ type: 'lightning.struck', zone: 0 }]);
    expect(onScreen.trauma()).toBeGreaterThan(0);
    const offScreen = setup();
    offScreen.drain([{ type: 'lightning.struck', zone: 1 }]);
    expect(offScreen.trauma()).toBe(0);
  });
});
