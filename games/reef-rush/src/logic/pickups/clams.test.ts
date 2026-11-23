import { createRng } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { CHARGES } from '../powerups/charges.ts';
import { CLAM } from '../powerups/tuning.ts';
import { activeRacers } from '../racers.ts';
import { eventsIn, giveItems, placeOnTile, raceOn, racerOf } from '../test-world.ts';
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
  it('opens on touch, grants the roll with its charges in the first empty slot and shuts for 90 ticks', () => {
    const { world, log, player, racers } = parkedOnClam();

    openClams(world, racers);

    const kind = player.items[0]?.kind ?? 'none';
    expect(kind).not.toBe('none');
    const charges = CHARGES[kind as PowerUpKind];
    expect(player.items).toEqual([{ kind, charges }, null, null]);
    expect(eventsIn(log)).toEqual([
      { type: 'clam.opened', id: 'player', index: 0, kind },
      { type: 'powerup.gained', id: 'player', kind, slot: 0, charges },
    ]);
    expect(world.clams[0]?.closedFor).toBe(CLAM.closedTicks);
  });

  it('stays shut for 90 ticks under a racer parked on it, then opens again', () => {
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

    expect(opened.player.items[0]?.kind).toBe(rollClam(fresh.world.rngs.pickups, 1, []));
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

  it('shape what rolls come up: the leader gets defence and a rare Squid, the trailer speed and attacks', () => {
    const leader = rollShares(1, []);
    const trailer = rollShares(4, []);
    const attacks = (shares: Record<PowerUpKind, number>) => shares.homingSquid + shares.riptide + shares.undertow;

    expect(attacks(leader)).toBeCloseTo(leader.homingSquid, 9);
    expect(leader.bubbleShield + leader.glowLantern + leader.mimic).toBeGreaterThan(0.6);
    expect(leader.jetFin).toBeCloseTo(1 / 14, 1);
    expect(attacks(trailer)).toBeGreaterThan(0.35);
    expect(trailer.mimic).toBe(0);
    expect(trailer.jetFin).toBeGreaterThan(leader.jetFin);
  });

  it('weigh the Homing Squid 1 in 1st and 4 in last, so a trailer rolls it about four times as often', () => {
    const squid = [1, 2, 3, 4].map((place) => clamWeights(place).homingSquid);
    const leader = rollShares(1, []).homingSquid;
    const trailer = rollShares(4, []).homingSquid;

    expect(squid).toEqual([1, 2, 3, 4]);
    expect(leader).toBeCloseTo(1 / 14, 1);
    expect(trailer).toBeCloseTo(4 / 20, 1);
  });

  it('never roll Undertow for 1st or 2nd, over thousands of rolls', () => {
    for (const place of [1, 2]) expect(rollShares(place, [], 3000).undertow, `place ${place}`).toBe(0);
    expect(rollShares(3, [], 3000).undertow).toBeGreaterThan(0.05);
  });

  it('never roll a kind the racer holds', () => {
    const held = ['jetFin', 'puffer', 'inkSac', 'mimic'] as const;
    const shares = rollShares(1, held, 1000);

    expect(held.map((kind) => shares[kind])).toEqual([0, 0, 0, 0]);
    expect(shares.bubbleShield).toBeCloseTo(3 / 7, 1);
    expect(shares.glowLantern).toBeCloseTo(3 / 7, 1);
    expect(shares.homingSquid).toBeCloseTo(1 / 7, 1);
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
    expect(fourth.player.items[0]?.kind).toBe(asFourth);
  });

  it('goes to the first racer in RACER_IDS order when two touch it at once', () => {
    const { world, log, racers } = parkedOnClam();
    placeOnTile(racerOf(world, 'tess'), 5, 2);

    openClams(world, racers);

    expect(eventsIn(log, 'clam.opened').map((event) => 'id' in event && event.id)).toEqual(['player']);
    expect(racerOf(world, 'tess').items).toEqual([null, null, null]);
  });

  it('passes over a racer whose slots are all full to the next racer touching it', () => {
    const { world, log, player, racers } = parkedOnClam();
    giveItems(player, ['jetFin', 'puffer', 'inkSac']);
    placeOnTile(racerOf(world, 'squib'), 5, 2);

    openClams(world, racers);

    expect(eventsIn(log, 'clam.opened').map((event) => 'id' in event && event.id)).toEqual(['squib']);
    expect(player.items.map((item) => item?.kind)).toEqual(['jetFin', 'puffer', 'inkSac']);
  });

  it('fills a rival with up to three different rolls from one clam, announcing the first', () => {
    const { world, log, racers } = parkedOnClam();
    const tess = racerOf(world, 'tess');
    placeOnTile(racerOf(world, 'player'), 8, 1);
    placeOnTile(tess, 5, 2);

    openClams(world, racers);

    const kinds = tess.items.map((item) => item?.kind);
    expect(new Set(kinds).size).toBe(3);
    expect(kinds).not.toContain(undefined);
    expect(eventsIn(log, 'clam.opened')).toEqual([{ type: 'clam.opened', id: 'tess', index: 0, kind: kinds[0] }]);
    expect(eventsIn(log, 'powerup.gained').map((event) => 'kind' in event && event.kind)).toEqual(kinds);
    expect(world.clams[0]?.closedFor).toBe(CLAM.closedTicks);
  });

  it('rolls a rival only as many items as it has empty slots', () => {
    const { world, log, racers } = parkedOnClam();
    const tess = racerOf(world, 'tess');
    giveItems(tess, ['jetFin', null, null]);
    placeOnTile(racerOf(world, 'player'), 8, 1);
    placeOnTile(tess, 5, 2);

    openClams(world, racers);

    expect(tess.items.filter((item) => item !== null)).toHaveLength(3);
    expect(eventsIn(log, 'powerup.gained')).toHaveLength(2);
  });

  it('gives the player one roll from a clam, leaving its other slots empty', () => {
    const { world, player, racers } = parkedOnClam();

    openClams(world, racers);

    expect(player.items.filter((item) => item !== null)).toHaveLength(1);
  });

  it('stays ready, drawing nothing, when only a full racer touches it', () => {
    const { world, log, player, racers } = parkedOnClam();
    giveItems(player, ['jetFin', 'puffer', 'inkSac']);
    const before = world.rngs.pickups.state();

    openClams(world, racers);

    expect(eventsIn(log)).toEqual([]);
    expect(world.clams[0]?.closedFor).toBe(0);
    expect(world.rngs.pickups.state()).toBe(before);
  });

  it('gives a Homing Squid one charge in 1st or 2nd and three in 3rd or 4th', () => {
    const squidCharges = [1, 2, 3, 4].map((place) => {
      // The first seed whose first pickups draw rolls a Squid in this place, found rather than pinned.
      const seed = Array.from({ length: 500 }, (_, i) => i + 1).find(
        (candidate) => rollClam(parkedOnClam(candidate).world.rngs.pickups, place, []) === 'homingSquid',
      );
      const scene = parkedOnClam(seed);
      scene.player.place = place;
      openClams(scene.world, scene.racers);
      return scene.player.items[0];
    });

    expect(squidCharges).toEqual([1, 1, 3, 3].map((charges) => ({ kind: 'homingSquid', charges })));
  });

  it('rejects a place outside 1 to 4', () => {
    for (const place of [0, 5, 2.5]) {
      expect(() => clamWeights(place), `place ${place}`).toThrow(RangeError);
    }
  });
});
