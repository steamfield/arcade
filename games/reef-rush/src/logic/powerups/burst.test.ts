import { describe, expect, it } from 'vitest';
import { centreOf, hitbox } from '../racers.ts';
import { eventsIn, hold, IDLE, placeOnTile, raceOn, racerOf, step, ticksOf } from '../test-world.ts';
import type { PowerUpKind, Vec } from '../types.ts';
import { driveDash, fireBurst } from './burst.ts';
import { gainPowerUp } from './stack.ts';

/** The player's lane is two rows tall with coral right in front of the start and a way round below. */
const LANES = `
  ####################
  #1C...............F#
  #.................F#
  ####################
  #2................F#
  ####################
  #3................F#
  ####################
  #4................F#
  ####################
`;

/** Tess starts two tiles ahead of the player in a shared lane. */
const SHARED_LANE = `
  ####################
  #1.2..............F#
  ####################
  #3................F#
  ####################
  #4................F#
  ####################
`;

/** Jellies 3 and 7 tiles right of tile (5, 4). */
const OPEN = `
  ##################
  #1..............F#
  #...............F#
  #...............F#
  #.......j...j...F#
  #2..............F#
  #...............F#
  #3..............F#
  #4..............F#
  ##################
`;

const STILL: Vec = { x: 0, y: 0 };
const RIGHT: Vec = { x: 1, y: 0 };

function holding(kinds: PowerUpKind[], ascii = OPEN) {
  const { world, log } = raceOn(ascii);
  const player = racerOf(world, 'player');
  player.stack = kinds;
  return { world, log, player };
}

describe('firing', () => {
  it('does nothing with an empty stack', () => {
    const { world, log, player } = holding([]);

    expect(fireBurst(world, player, RIGHT)).toBe(false);
    expect(eventsIn(log)).toEqual([]);
    expect(player.burstCooldown).toBe(0);
  });

  it('does nothing while the burst is cooling down', () => {
    const { world, log, player } = holding(['inkSac']);
    player.burstCooldown = 1;

    expect(fireBurst(world, player, RIGHT)).toBe(false);
    expect(eventsIn(log)).toEqual([]);
    expect(world.inks).toEqual([]);
  });

  it('fires every held power-up at once, keeps them, and cools down for 150 ticks', () => {
    const { world, log, player } = holding(['bubbleShield', 'puffer']);

    expect(fireBurst(world, player, RIGHT)).toBe(true);

    expect(player.burstCooldown).toBe(150);
    expect(player.stack).toEqual(['bubbleShield', 'puffer']);
    expect(world.bubbles).toHaveLength(1);
    expect(player.status.inflated).toBe(60);
    expect(eventsIn(log)).toEqual([
      { type: 'burst.fired', id: 'player', kinds: ['bubbleShield', 'puffer'], combo: null },
      { type: 'bubble.spawned', owner: 'player' },
    ]);
  });

  it('fires again 150 ticks later while the button is held', () => {
    const { world, log } = holding(['puffer'], LANES);
    placeOnTile(racerOf(world, 'player'), 8, 2);

    step(world, log, 301, hold(STILL, { burst: true }));
    const fired = ticksOf(log, 'burst.fired');

    expect(fired.slice(1).map((tick, i) => tick - (fired[i] ?? 0))).toEqual([150, 150]);
  });
});

describe('Jet Fins', () => {
  it('dashes for 24 ticks at 200 px/s along the input', () => {
    const { world, log, player } = holding(['jetFin'], LANES);
    placeOnTile(player, 1, 2);
    const velocities: Vec[] = [];
    for (let i = 0; i < 26; i++) {
      step(world, log, 1, hold(RIGHT, { burst: i === 0 }));
      velocities.push({ x: player.body.vx, y: player.body.vy });
    }

    for (const [i, v] of velocities.slice(0, 24).entries()) {
      expect(v.x, `tick ${i}`).toBeCloseTo(200, 6);
      expect(v.y, `tick ${i}`).toBeCloseTo(0, 6);
    }
    expect(velocities[24]?.x).toBeLessThan(199);
  });

  it('dashes along its facing with no input, and along a diagonal input', () => {
    const still = holding(['jetFin']);
    still.player.facing = -1;
    fireBurst(still.world, still.player, STILL);
    const diagonal = holding(['jetFin']);
    fireBurst(diagonal.world, diagonal.player, { x: 1, y: 1 });

    expect(still.player.status.dashing).toBe(24);
    expect(still.player.dashDir).toEqual({ x: -1, y: 0 });
    expect(still.player.body.vx).toBeCloseTo(-200, 6);
    expect(diagonal.player.dashDir.x).toBeCloseTo(Math.SQRT1_2, 9);
    expect(diagonal.player.dashDir.y).toBeCloseTo(Math.SQRT1_2, 9);
    expect(Math.hypot(diagonal.player.body.vx, diagonal.player.body.vy)).toBeCloseTo(200, 6);
  });
});

describe('Bubble Shield', () => {
  it('fires a bubble from the racer centre at 150 px/s that lasts 90 ticks', () => {
    const { world, log, player } = holding(['bubbleShield']);

    fireBurst(world, player, RIGHT);

    expect(world.bubbles).toEqual([{ ...centreOf(player), vx: 150, vy: 0, ttl: 90, owner: 'player', seeking: false }]);
    expect(eventsIn(log, 'bubble.spawned')).toEqual([{ type: 'bubble.spawned', owner: 'player' }]);
  });

  it('traps the racer ahead that it reaches', () => {
    const { world, log } = holding(['bubbleShield'], SHARED_LANE);

    step(world, log, 1, hold(RIGHT, { burst: true }));
    step(world, log, 89, IDLE);

    expect(eventsIn(log, 'bubble.popped', 'racer.trapped')).toEqual([
      { type: 'bubble.popped', by: 'tess' },
      { type: 'racer.trapped', id: 'tess', by: 'player' },
    ]);
  });
});

describe('Puffer', () => {
  it('inflates for 60 ticks into a 20 px hitbox centred on the body', () => {
    const { world, player } = holding(['puffer']);
    const centre = centreOf(player);

    fireBurst(world, player, RIGHT);

    expect(player.status.inflated).toBe(60);
    expect(hitbox(player)).toEqual({ x: centre.x - 10, y: centre.y - 10, w: 20, h: 20 });
  });

  it('breaks coral its hitbox touches', () => {
    const { world, log } = holding(['puffer'], LANES);

    step(world, log, 1, hold(STILL, { burst: true }));

    expect(eventsIn(log, 'coral.broken')).toEqual([{ type: 'coral.broken', tx: 2, ty: 1, by: 'player' }]);
  });
});

describe('Ink Sac', () => {
  it('drops a 32 px cloud 20 px behind the racer that lasts 240 ticks', () => {
    const right = holding(['inkSac']);
    fireBurst(right.world, right.player, STILL);
    const left = holding(['inkSac']);
    left.player.facing = -1;
    fireBurst(left.world, left.player, STILL);
    const centre = centreOf(right.player);

    expect(right.world.inks).toEqual([{ x: centre.x - 20, y: centre.y, radius: 16, ttl: 240, owner: 'player' }]);
    expect(left.world.inks).toEqual([{ x: centre.x + 20, y: centre.y, radius: 16, ttl: 240, owner: 'player' }]);
    expect(eventsIn(right.log, 'ink.spawned')).toEqual([{ type: 'ink.spawned', owner: 'player' }]);
  });
});

describe('Glow Lantern', () => {
  /** Player at (5, 4); Tess 3 tiles right, Squib 5 tiles right, Bo 3 tiles up. */
  function flashScene() {
    const scene = holding(['glowLantern']);
    placeOnTile(scene.player, 5, 4);
    placeOnTile(racerOf(scene.world, 'tess'), 8, 4);
    placeOnTile(racerOf(scene.world, 'squib'), 10, 4);
    placeOnTile(racerOf(scene.world, 'bo'), 5, 1);
    return scene;
  }

  it('stuns other racers within 4 tiles for 45 ticks and leaves the rest', () => {
    const { world, log, player } = flashScene();

    fireBurst(world, player, RIGHT);

    expect(eventsIn(log).slice(1)).toEqual([
      { type: 'flash.fired', id: 'player' },
      { type: 'racer.hit', id: 'tess', cause: 'flash', by: 'player' },
      { type: 'racer.stunned', id: 'tess' },
      { type: 'racer.hit', id: 'bo', cause: 'flash', by: 'player' },
      { type: 'racer.stunned', id: 'bo' },
    ]);
    expect(racerOf(world, 'tess').status.stunned).toBe(45);
    expect(racerOf(world, 'squib').status.stunned).toBe(0);
    expect(player.status.stunned).toBe(0);
  });

  it('pops a shield instead of stunning, and passes over invulnerable racers', () => {
    const { world, log, player } = flashScene();
    racerOf(world, 'tess').stack = ['bubbleShield'];
    racerOf(world, 'bo').status.invulnerable = 10;

    fireBurst(world, player, RIGHT);

    expect(eventsIn(log).slice(1)).toEqual([
      { type: 'flash.fired', id: 'player' },
      { type: 'racer.hit', id: 'tess', cause: 'flash', by: 'player' },
      { type: 'shield.popped', id: 'tess' },
    ]);
    expect(racerOf(world, 'tess').status.stunned).toBe(0);
    expect(racerOf(world, 'bo').status.stunned).toBe(0);
  });

  it('stuns jellies within 4 tiles for 45 ticks', () => {
    const { world, player } = flashScene();

    fireBurst(world, player, RIGHT);

    expect(world.jellies.map((jelly) => jelly.stunned)).toEqual([45, 0]);
  });
});

describe('a dash after it fires', () => {
  it('keeps the combos it fired with: a Glow Lantern gained mid-dash adds no comet flash', () => {
    const { world, log, player } = holding(['jetFin'], LANES);
    placeOnTile(player, 1, 2);
    step(world, log, 1, hold(RIGHT, { burst: true }));
    step(world, log, 5, hold(RIGHT));

    gainPowerUp(world, player, 'glowLantern');
    step(world, log, 25, hold(RIGHT));

    expect(eventsIn(log, 'flash.fired')).toEqual([]);
  });

  it('leaves velocity alone and forgets its combos once dashing is over', () => {
    const { player } = holding(['jetFin', 'glowLantern']);
    player.dashDir = { x: 1, y: 0 };
    player.dashCombos = ['comet'];
    player.body.vx = 30;
    player.body.vy = -40;

    driveDash(player);

    expect({ vx: player.body.vx, vy: player.body.vy }).toEqual({ vx: 30, vy: -40 });
    expect(player.dashCombos).toEqual([]);
  });
});
