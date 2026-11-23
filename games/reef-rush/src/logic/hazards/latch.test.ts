import { describe, expect, it } from 'vitest';
import { SQUID } from '../powerups/tuning.ts';
import { eventsIn, hold, IDLE, raceOn, racerOf, step } from '../test-world.ts';

/** Open water, long enough that nobody reaches a wall. */
const POOL = `
  ##############################
  #1..........................F#
  #2..........................F#
  #3..........................F#
  #4..........................F#
  ##############################
`;

const KICK = hold({ x: 0, y: 0 }, { kick: true });

/** The player, latched for `ticks`, in a race where the rivals sit still. */
function latched(ticks: number) {
  const { world, log } = raceOn(POOL);
  for (const id of ['tess', 'squib', 'bo'] as const) racerOf(world, id).status.stunned = 100_000;
  const player = racerOf(world, 'player');
  player.status.latched = ticks;
  return { world, log, player };
}

describe('shaking off a latch', () => {
  it('takes 30 ticks off for each kick', () => {
    const kicked = latched(150);
    const idle = latched(150);

    step(kicked.world, kicked.log, 1, KICK);
    step(idle.world, idle.log, 1, IDLE);

    expect(idle.player.status.latched - kicked.player.status.latched).toBe(30);
  });

  it('ends early with racer.shaken once kicks have taken it all off', () => {
    const { world, log, player } = latched(70);

    // Kicks are 36 ticks apart: 70 -> 39 -> 8 -> shaken on the third.
    for (let kick = 0; kick < 3; kick++) {
      step(world, log, 1, KICK);
      step(world, log, 36, IDLE);
    }

    expect(player.status.latched).toBe(0);
    expect(eventsIn(log, 'racer.shaken')).toEqual([{ type: 'racer.shaken', id: 'player' }]);
  });

  it('says nothing when the latch simply runs out', () => {
    const { world, log, player } = latched(20);

    step(world, log, 25, IDLE);

    expect(player.status.latched).toBe(0);
    expect(eventsIn(log, 'racer.shaken')).toEqual([]);
  });

  it("is not shaken by someone else's kick", () => {
    const { world, log, player } = latched(150);
    world.events.emit({ type: 'racer.kicked', id: 'tess' });

    step(world, log, 1, IDLE);

    expect(player.status.latched).toBe(149);
  });
});

describe('being latched', () => {
  /** Distance the player swims right in 60 ticks, holding right. */
  const distanceHeld = (latchTicks: number) => {
    const { world, log, player } = latched(latchTicks);
    const before = player.body.x;
    step(world, log, 60, hold({ x: 1, y: 0 }));
    return player.body.x - before;
  };

  it('slows the swim to the latched share of its force', () => {
    const free = distanceHeld(0);
    const held = distanceHeld(1000);

    expect(held).toBeLessThan(free * (SQUID.latchedForceMul + 0.15));
    expect(held).toBeGreaterThan(free * (SQUID.latchedForceMul - 0.15));
  });

  it('pushes the racer up and down instead of letting it hold a line', () => {
    const { world, log, player } = latched(1000);
    const heights: number[] = [];
    for (let i = 0; i < 120; i++) {
      step(world, log, 1, hold({ x: 1, y: 0 }));
      heights.push(player.body.y);
    }
    const free = latched(0);
    const level: number[] = [];
    for (let i = 0; i < 120; i++) {
      step(free.world, free.log, 1, hold({ x: 1, y: 0 }));
      level.push(free.player.body.y);
    }

    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(3);
    expect(Math.max(...level) - Math.min(...level)).toBeLessThan(0.5);
  });
});
