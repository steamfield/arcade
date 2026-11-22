import { createRng } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { CLAM } from '../powerups/tuning.ts';
import { activeRacers } from '../racers.ts';
import { eventsIn, placeOnTile, raceOn, racerOf } from '../test-world.ts';
import { POWER_UP_KINDS, type PowerUpKind } from '../types.ts';
import { clamWeights, openClams, rollClam } from './clams.ts';

/** A clam at tile (5, 2) in open water. */
const CLAM_BOX = `
  ############
  #1........F#
  #2...?....F#
  #3........F#
  #4........F#
  ############
`;

function parkedOnClam(seed = 1) {
  const { world, log } = raceOn(CLAM_BOX, { seed });
  const player = racerOf(world, 'player');
  placeOnTile(player, 5, 2);
  return { world, log, player, racers: activeRacers(world) };
}

/** How often each kind comes up in `rolls` rolls from one seeded stream. */
function rollShares(place: number, held: readonly PowerUpKind[], rolls = 4000): Record<PowerUpKind, number> {
  const rng = createRng(17);
  const counts = Object.fromEntries(POWER_UP_KINDS.map((kind) => [kind, 0])) as Record<PowerUpKind, number>;
  for (let i = 0; i < rolls; i++) counts[rollClam(rng, place, held)] += 1;
  return Object.fromEntries(POWER_UP_KINDS.map((kind) => [kind, counts[kind] / rolls])) as Record<PowerUpKind, number>;
}

describe('opening a clam', () => {
  it('opens on touch, grants the roll and shuts for 240 ticks', () => {
    const { world, log, player, racers } = parkedOnClam();

    openClams(world, racers);

    const kind = player.stack[0];
    expect(player.stack).toHaveLength(1);
    expect(eventsIn(log)).toEqual([
      { type: 'clam.opened', id: 'player', index: 0, kind },
      { type: 'powerup.gained', id: 'player', kind },
    ]);
    expect(world.clams[0]?.closedFor).toBe(CLAM.closedTicks);
  });

  it('stays shut for 240 ticks under a racer parked on it, then opens again', () => {
    const { world, log, racers } = parkedOnClam();
    const openedOn: number[] = [];

    for (let call = 0; call < 2 + CLAM.closedTicks; call++) {
      const before = eventsIn(log, 'clam.opened').length;
      openClams(world, racers);
      if (eventsIn(log, 'clam.opened').length > before) openedOn.push(call);
    }

    expect(openedOn).toEqual([0, CLAM.closedTicks + 1]);
  });

  it('does not open for a racer one tile away', () => {
    const { world, log, player, racers } = parkedOnClam();
    placeOnTile(player, 6, 2);

    openClams(world, racers);

    expect(eventsIn(log)).toEqual([]);
    expect(world.clams[0]?.closedFor).toBe(0);
  });

  it('rolls from the pickups stream and no other', () => {
    const opened = parkedOnClam(5);
    const fresh = parkedOnClam(5);

    openClams(opened.world, opened.racers);

    expect(opened.player.stack).toEqual([rollClam(fresh.world.rngs.pickups, 1, [])]);
    expect(opened.world.rngs.pickups.state()).toBe(fresh.world.rngs.pickups.state());
    expect(opened.world.rngs['ai.tess'].state()).toBe(parkedOnClam(5).world.rngs['ai.tess'].state());
  });
});

describe('roll weights', () => {
  it('favour shields and lanterns in 1st and jets and puffers in 4th', () => {
    expect(clamWeights(1)).toEqual(CLAM.firstWeights);
    expect(clamWeights(4)).toEqual(CLAM.lastWeights);
  });

  it('interpolate linearly for 2nd and 3rd, except Undertow', () => {
    for (const kind of POWER_UP_KINDS.filter((candidate) => candidate !== 'undertow')) {
      const first = CLAM.firstWeights[kind];
      const last = CLAM.lastWeights[kind];
      expect(clamWeights(2)[kind], `${kind} in 2nd`).toBeCloseTo(first + (last - first) / 3, 9);
      expect(clamWeights(3)[kind], `${kind} in 3rd`).toBeCloseTo(first + ((last - first) * 2) / 3, 9);
    }
    expect(clamWeights(3).undertow).toBeCloseTo((CLAM.lastWeights.undertow * 2) / 3, 9);
  });

  it('give Undertow no weight ahead of 3rd, however the weights interpolate', () => {
    expect([1, 2].map((place) => clamWeights(place).undertow)).toEqual([0, 0]);
    expect(clamWeights(4).undertow).toBeGreaterThan(0);
  });

  it('shape what rolls come up: the leader gets defence, the trailer speed and attacks', () => {
    const leader = rollShares(1, []);
    const trailer = rollShares(4, []);
    const attacks = (shares: Record<PowerUpKind, number>) => shares.homingSquid + shares.riptide + shares.undertow;

    expect(attacks(leader)).toBe(0);
    expect(leader.bubbleShield + leader.glowLantern + leader.mimic).toBeGreaterThan(0.6);
    expect(leader.jetFin).toBeCloseTo(1 / 13, 1);
    expect(attacks(trailer)).toBeGreaterThan(0.35);
    expect(trailer.mimic).toBe(0);
    expect(trailer.jetFin).toBeGreaterThan(leader.jetFin);
  });

  it('never roll Undertow for 1st or 2nd, over thousands of rolls', () => {
    for (const place of [1, 2]) expect(rollShares(place, [], 3000).undertow, `place ${place}`).toBe(0);
    expect(rollShares(3, [], 3000).undertow).toBeGreaterThan(0.05);
  });

  it('never roll a kind the racer holds', () => {
    const held = ['jetFin', 'puffer', 'inkSac', 'mimic'] as const;
    const shares = rollShares(1, held, 1000);

    expect(held.map((kind) => shares[kind])).toEqual([0, 0, 0, 0]);
    expect(shares.bubbleShield).toBeCloseTo(0.5, 1);
    expect(shares.glowLantern).toBeCloseTo(0.5, 1);
  });
});

describe('who opens a clam', () => {
  it('rolls with the weights of the opener place', () => {
    const fourth = parkedOnClam(4);
    fourth.player.place = 4;

    openClams(fourth.world, fourth.racers);

    const asFourth = rollClam(parkedOnClam(4).world.rngs.pickups, 4, []);
    // The seed is one where 1st and 4th place roll differently, so the place really decides.
    expect(rollClam(parkedOnClam(4).world.rngs.pickups, 1, [])).not.toBe(asFourth);
    expect(fourth.player.stack).toEqual([asFourth]);
  });

  it('goes to the first racer in RACER_IDS order when two touch it at once', () => {
    const { world, log, racers } = parkedOnClam();
    placeOnTile(racerOf(world, 'tess'), 5, 2);

    openClams(world, racers);

    expect(eventsIn(log, 'clam.opened').map((event) => 'id' in event && event.id)).toEqual(['player']);
    expect(racerOf(world, 'tess').stack).toEqual([]);
  });

  it('rejects a place outside 1 to 4', () => {
    for (const place of [0, 5, 2.5]) {
      expect(() => clamWeights(place), `place ${place}`).toThrow(RangeError);
    }
  });
});
