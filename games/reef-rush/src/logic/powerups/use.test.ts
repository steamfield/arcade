import { describe, expect, it } from 'vitest';
import { applyHit } from '../hazards/hits.ts';
import { centreOf, hitbox } from '../racers.ts';
import { eventsIn, giveItems, hold, IDLE, placeOnTile, raceOn, racerOf, step } from '../test-world.ts';
import type { HeldItem, PowerUpKind, TickInput, Vec } from '../types.ts';
import { driveDash, fireItem } from './use.ts';

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

/** A coral gate four tiles ahead of the player, with Tess parked behind it and a way round below. */
const GATE = `
  #####################
  #1...C.2...........F#
  #..................F#
  #####################
  #3.................F#
  #####################
  #4.................F#
  #####################
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

function holding(items: (PowerUpKind | HeldItem | null)[], ascii = OPEN, selected = 0) {
  const { world, log } = raceOn(ascii);
  const player = racerOf(world, 'player');
  giveItems(player, items, selected);
  return { world, log, player };
}

describe('using the selected item', () => {
  it('fires only the selected item, spends one charge and cools down for 20 ticks', () => {
    const { world, log, player } = holding(['bubbleShield', 'puffer', 'inkSac'], OPEN, 1);

    step(world, log, 1, hold(RIGHT, { use: true }));

    expect(player.items).toEqual([
      { kind: 'bubbleShield', charges: 1 },
      { kind: 'puffer', charges: 1 },
      { kind: 'inkSac', charges: 3 },
    ]);
    expect(player.status.inflated).toBe(59);
    expect(world.bubbles).toEqual([]);
    expect(world.inks).toEqual([]);
    expect(player.useCooldown).toBe(19);
    expect(eventsIn(log, 'item.used')).toEqual([
      { type: 'item.used', id: 'player', kind: 'puffer', slot: 1, chargesLeft: 1 },
    ]);
  });

  it('ignores a second press during the cooldown and fires again once it runs out', () => {
    const { world, log, player } = holding(['inkSac']);

    step(world, log, 1, hold(STILL, { use: true }));
    step(world, log, 19, hold(STILL, { use: true }));
    const duringCooldown = eventsIn(log, 'item.used').length;
    step(world, log, 1, hold(STILL, { use: true }));

    expect(duringCooldown).toBe(1);
    expect(eventsIn(log, 'item.used')).toHaveLength(2);
    expect(player.items[0]).toEqual({ kind: 'inkSac', charges: 1 });
  });

  it('does nothing with nothing held', () => {
    const { world, log, player } = holding([]);

    step(world, log, 1, hold(RIGHT, { use: true }));

    expect(eventsIn(log, 'item.used', 'powerup.lost')).toEqual([]);
    expect(player.useCooldown).toBe(0);
  });

  it('empties the slot on the last charge and selects the next held slot to the right, wrapping', () => {
    const { world, log, player } = holding(['jetFin', null, { kind: 'inkSac', charges: 1 }], OPEN, 2);

    step(world, log, 1, hold(STILL, { use: true }));

    expect(player.items).toEqual([{ kind: 'jetFin', charges: 3 }, null, null]);
    expect(player.selected).toBe(0);
    expect(eventsIn(log, 'item.used', 'powerup.lost')).toEqual([
      { type: 'item.used', id: 'player', kind: 'inkSac', slot: 2, chargesLeft: 0 },
      { type: 'powerup.lost', id: 'player', kind: 'inkSac', cause: 'used' },
    ]);
  });

  it('leaves the selection put when the last held item is used up', () => {
    const { world, log, player } = holding([null, 'mimic'], OPEN, 1);

    step(world, log, 1, hold(STILL, { use: true }));

    expect(player.items).toEqual([null, null, null]);
    expect(player.selected).toBe(1);
  });
});

describe('cycling and using in one tick', () => {
  it('cycles first, so a press of both fires the newly selected item', () => {
    const { world, log, player } = holding(['puffer', 'inkSac']);

    step(world, log, 1, hold(STILL, { use: true, cycle: 1 }));

    expect(eventsIn(log, 'item.selected', 'item.used')).toEqual([
      { type: 'item.selected', id: 'player', slot: 1, kind: 'inkSac' },
      { type: 'item.used', id: 'player', kind: 'inkSac', slot: 1, chargesLeft: 2 },
    ]);
    expect(player.status.inflated).toBe(0);
  });

  it('still cycles while stunned or trapped, but fires, kicks and swims nothing', () => {
    for (const status of ['stunned', 'trapped'] as const) {
      const { world, log, player } = holding(['puffer', 'inkSac']);
      player.status[status] = 30;

      step(world, log, 1, hold(RIGHT, { use: true, kick: true, cycle: -1 }));

      expect(player.selected, status).toBe(1);
      expect(eventsIn(log, 'item.used', 'racer.kicked'), status).toEqual([]);
      expect(player.body.vx, status).toBe(0);
    }
  });
});

describe('firing a chosen slot', () => {
  it('selects that slot and fires it in the same tick', () => {
    const { world, log, player } = holding(['puffer', 'inkSac']);

    step(world, log, 1, hold(STILL, { useSlot: 1 }));

    expect(player.selected).toBe(1);
    expect(eventsIn(log, 'item.selected', 'item.used')).toEqual([
      { type: 'item.selected', id: 'player', slot: 1, kind: 'inkSac' },
      { type: 'item.used', id: 'player', kind: 'inkSac', slot: 1, chargesLeft: 2 },
    ]);
  });

  it('does nothing for an empty or out-of-range slot', () => {
    const { world, log, player } = holding(['puffer', null]);

    step(world, log, 1, hold(STILL, { useSlot: 1 }));
    step(world, log, 1, hold(STILL, { useSlot: 3 }));
    step(world, log, 1, hold(STILL, { useSlot: -1 }));

    expect(eventsIn(log, 'item.selected', 'item.used')).toEqual([]);
    expect(player.selected).toBe(0);
    expect(player.useCooldown).toBe(0);
  });
});

describe('Jet Fins', () => {
  it('boosts for 24 ticks at 200 px/s along the input', () => {
    const { world, log, player } = holding(['jetFin'], LANES);
    placeOnTile(player, 1, 2);
    const velocities: Vec[] = [];
    for (let i = 0; i < 26; i++) {
      step(world, log, 1, hold(RIGHT, { use: i === 0 }));
      velocities.push({ x: player.body.vx, y: player.body.vy });
    }

    for (const [i, v] of velocities.slice(0, 24).entries()) {
      expect(v.x, `tick ${i}`).toBeCloseTo(200, 6);
      expect(v.y, `tick ${i}`).toBeCloseTo(0, 6);
    }
    expect(velocities[24]?.x).toBeLessThan(199);
  });

  it('boosts along its facing with no input, and along a diagonal input', () => {
    const still = holding(['jetFin']);
    still.player.facing = -1;
    fireItem(still.world, still.player, 0, STILL);
    const diagonal = holding(['jetFin']);
    fireItem(diagonal.world, diagonal.player, 0, { x: 1, y: 1 });

    expect(still.player.status.dashing).toBe(24);
    expect(still.player.dashDir).toEqual({ x: -1, y: 0 });
    expect(still.player.body.vx).toBeCloseTo(-200, 6);
    expect(diagonal.player.dashDir.x).toBeCloseTo(Math.SQRT1_2, 9);
    expect(diagonal.player.dashDir.y).toBeCloseTo(Math.SQRT1_2, 9);
    expect(Math.hypot(diagonal.player.body.vx, diagonal.player.body.vy)).toBeCloseTo(200, 6);
  });

  it('does not inflate with a Puffer held: there are no combos', () => {
    const { world, player } = holding(['jetFin', 'puffer']);

    fireItem(world, player, 0, RIGHT);

    expect(player.status.inflated).toBe(0);
  });

  it('ends when a hit lands', () => {
    const { world, player } = holding(['jetFin', 'puffer']);
    fireItem(world, player, 0, RIGHT);

    applyHit(world, player, 'urchin', null, centreOf(player));

    expect(player.status.dashing).toBe(0);
  });
});

describe('dashing kinds during a dash', () => {
  it('fires no Jet Fins or Cannonball while a dash runs: no charge spent, nothing emitted', () => {
    for (const kind of ['jetFin', 'cannonball'] as const) {
      const { world, log, player } = holding([kind]);
      player.status.dashing = 5;

      expect(fireItem(world, player, 0, RIGHT), kind).toBe(false);
      expect(player.items[0]?.charges, kind).toBe(kind === 'jetFin' ? 3 : 1);
      expect(eventsIn(log), kind).toEqual([]);
    }
  });

  it('lets a Puffer fire mid-dash, lengthening inflation but never shortening it', () => {
    const { world, player } = holding(['puffer']);
    player.status.dashing = 5;
    player.status.inflated = 70;

    expect(fireItem(world, player, 0, RIGHT)).toBe(true);
    const kept = player.status.inflated;
    player.useCooldown = 0;
    player.status.inflated = 10;
    fireItem(world, player, 0, RIGHT);

    expect([kept, player.status.inflated]).toEqual([70, 60]);
  });
});

describe('Cannonball', () => {
  it('dashes 75 ticks at 250 px/s, inflated and cannonballing the whole way', () => {
    const { world, player } = holding(['cannonball'], GATE);

    fireItem(world, player, 0, RIGHT);

    expect(player.status).toMatchObject({ dashing: 75, inflated: 75, cannonball: 75, invulnerable: 0 });
    expect(player.dashSpeed).toBe(250);
    expect(player.body.vx).toBeCloseTo(250, 6);
  });

  it('breaks the coral gate and hits the racer behind it, and no hit ends it early', () => {
    const { world, log, player } = holding(['cannonball'], GATE);
    // Put back on her start tile every tick so Tess sits behind the gate instead of racing off. A stun
    // would hold her too, but stunned racers are passed through, so the Cannonball would never hit her.
    const tess = racerOf(world, 'tess');
    const pinnedStep = (input: TickInput) => {
      if (tess.status.stunned === 0) placeOnTile(tess, 7, 1);
      step(world, log, 1, input);
    };

    pinnedStep(hold(RIGHT, { use: true }));
    applyHit(world, player, 'urchin', null, centreOf(player));
    for (let i = 0; i < 20; i++) pinnedStep(hold(RIGHT));

    expect(eventsIn(log, 'coral.broken')).toEqual([{ type: 'coral.broken', tx: 5, ty: 1, by: 'player' }]);
    expect(eventsIn(log, 'racer.hit')).toEqual([{ type: 'racer.hit', id: 'tess', cause: 'puffer', by: 'player' }]);
    expect(player.status.dashing).toBe(54);
  });

  it('never sets the hit flicker, and a hit during the run does nothing until it ends', () => {
    const long = `
      ###########################################
      #1.......................................F#
      #2.......................................F#
      #3.......................................F#
      #4.......................................F#
      ###########################################
    `;
    const { world, log, player } = holding(['cannonball', 'puffer'], long);
    step(world, log, 1, hold(RIGHT, { use: true }));
    const seenInvulnerable: number[] = [];
    const outcomes: (string | null)[] = [];

    for (let tick = 0; tick < 73; tick++) {
      outcomes.push(applyHit(world, player, 'urchin', null, centreOf(player)));
      seenInvulnerable.push(player.status.invulnerable);
      step(world, log, 1, hold(RIGHT));
    }

    expect(new Set(outcomes)).toEqual(new Set([null]));
    expect(new Set(seenInvulnerable)).toEqual(new Set([0]));
    expect(eventsIn(log, 'racer.hit')).not.toContainEqual(expect.objectContaining({ id: 'player' }));
    expect(player.items[1]).toEqual({ kind: 'puffer', charges: 2 });
    expect(player.status.cannonball).toBe(1);
    step(world, log, 1, hold(RIGHT));
    expect(applyHit(world, player, 'urchin', null, centreOf(player))).toBe('knocked');
  });
});

describe('Bubble Shield', () => {
  it('fires a trap bubble from the racer centre at 150 px/s that lasts 90 ticks', () => {
    const { world, log, player } = holding(['bubbleShield']);

    fireItem(world, player, 0, RIGHT);

    expect(world.bubbles).toEqual([{ ...centreOf(player), vx: 150, vy: 0, ttl: 90, owner: 'player' }]);
    expect(eventsIn(log, 'bubble.spawned')).toEqual([{ type: 'bubble.spawned', owner: 'player' }]);
  });

  it('traps the racer ahead that it reaches', () => {
    const { world, log } = holding(['bubbleShield'], SHARED_LANE);

    step(world, log, 1, hold(RIGHT, { use: true }));
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

    fireItem(world, player, 0, RIGHT);

    expect(player.status.inflated).toBe(60);
    expect(hitbox(player)).toEqual({ x: centre.x - 10, y: centre.y - 10, w: 20, h: 20 });
  });

  it('breaks coral its hitbox touches', () => {
    const { world, log } = holding(['puffer'], LANES);

    step(world, log, 1, hold(STILL, { use: true }));

    expect(eventsIn(log, 'coral.broken')).toEqual([{ type: 'coral.broken', tx: 2, ty: 1, by: 'player' }]);
  });
});

describe('Ink Sac', () => {
  it('drops one 32 px cloud 20 px behind the racer that lasts 240 ticks', () => {
    const right = holding(['inkSac']);
    fireItem(right.world, right.player, 0, STILL);
    const left = holding(['inkSac']);
    left.player.facing = -1;
    fireItem(left.world, left.player, 0, STILL);
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

    fireItem(world, player, 0, RIGHT);

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
    giveItems(racerOf(world, 'tess'), ['bubbleShield']);
    racerOf(world, 'bo').status.invulnerable = 10;

    fireItem(world, player, 0, RIGHT);

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

    fireItem(world, player, 0, RIGHT);

    expect(world.jellies.map((jelly) => jelly.stunned)).toEqual([45, 0]);
  });
});

describe('the other kinds', () => {
  it('each fire their one plain effect', () => {
    const fired = (['homingSquid', 'riptide', 'undertow', 'mimic'] as const).map((kind) => {
      const { world, log, player } = holding([kind]);
      placeOnTile(player, 5, 4);
      fireItem(world, player, 0, RIGHT);
      return eventsIn(log)
        .filter((event) => event.type !== 'item.used' && event.type !== 'powerup.lost')
        .map((event) => event.type);
    });

    expect(fired).toEqual([['squid.spawned'], ['riptide.spawned'], ['undertow.fired'], ['decoy.spawned']]);
  });
});

describe('a dash after it fires', () => {
  it('leaves velocity alone once dashing is over', () => {
    const { world, player } = holding(['jetFin']);
    player.dashDir = { x: 1, y: 0 };
    player.dashSpeed = 200;
    player.body.vx = 30;
    player.body.vy = -40;

    driveDash(world, player);

    expect({ vx: player.body.vx, vy: player.body.vy }).toEqual({ vx: 30, vy: -40 });
  });
});
