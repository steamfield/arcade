import { describe, expect, it } from 'vitest';
import { racerSeesInDark } from '../abilities.ts';
import { lockRangePx } from '../hazards/squid-target.ts';
import { SWIM_TUNING } from '../media/swim/tuning.ts';
import { modifiersFor } from '../modifiers.ts';
import { collectPearls } from '../pickups/pearls.ts';
import { activeRacers } from '../racers.ts';
import { eventsIn, giveItems, placeAt, placeOnTile, raceOn, racerOf, step, tileCentre } from '../test-world.ts';
import { type PowerUpKind, TILE, type World } from '../types.ts';
import { bumpMass } from './passives.ts';
import { MIMIC, SQUID } from './tuning.ts';

const BOX = `
  ############
  #1........F#
  #2........F#
  #3........F#
  #4........F#
  ############
`;

/** One pearl at tile (8, 2). */
const PEARL_BOX = `
  ############
  #1........F#
  #2......o.F#
  #3........F#
  #4........F#
  ############
`;

function playerIn(ascii = BOX) {
  const { world, log } = raceOn(ascii);
  return { world, log, player: racerOf(world, 'player') };
}

describe('Jet Fins', () => {
  it('swims with 15% more force and kicks again after 22 ticks', () => {
    const { world, player } = playerIn();
    giveItems(player, ['jetFin']);

    expect(modifiersFor(world, player)).toEqual({ ...SWIM_TUNING.base, forceMul: 1.15, kickCooldownTicks: 22 });
  });
});

describe('passives come from the selected item only', () => {
  it('changes nothing while Jet Fins, Puffer, Glow Lantern, Riptide and Mimic sit unselected', () => {
    const { world, log, player } = playerIn(PEARL_BOX);
    const bare = { mods: modifiersFor(world, player), mass: bumpMass(player), lock: lockRangePx(player) };
    giveItems(player, ['inkSac', 'jetFin', 'puffer']);
    const unselected = { mods: modifiersFor(world, player), mass: bumpMass(player), lock: lockRangePx(player) };
    giveItems(player, ['inkSac', 'glowLantern', 'mimic']);
    placeOnTile(player, 5, 2);
    collectPearls(world, activeRacers(world));

    expect(unselected).toEqual(bare);
    expect(lockRangePx(player)).toBe(bare.lock);
    expect(racerSeesInDark(player)).toBe(false);
    expect(eventsIn(log)).toEqual([]);
  });

  it('applies once that item is selected', () => {
    const { world, player } = playerIn();
    giveItems(player, ['inkSac', 'jetFin', 'mimic'], 1);
    const jet = modifiersFor(world, player).forceMul;
    giveItems(player, ['inkSac', 'jetFin', 'mimic'], 2);

    expect(jet).toBeCloseTo(1.15, 9);
    expect(lockRangePx(player)).toBe(SQUID.lockTiles * TILE * MIMIC.lockRangeMul);
  });
});

describe('Being latched by a squid', () => {
  it('cuts swim force to the latched share, whatever else is held', () => {
    const { world, player } = playerIn();
    player.status.latched = 100;
    giveItems(player, ['jetFin']);

    expect(modifiersFor(world, player).forceMul).toBeCloseTo(1.15 * SQUID.latchedForceMul, 9);
    player.status.latched = 0;
    expect(modifiersFor(world, player).forceMul).toBeCloseTo(1.15, 9);
  });
});

describe('Glow Lantern', () => {
  it('collects a pearl 3 tiles away', () => {
    const { world, log, player } = playerIn(PEARL_BOX);
    giveItems(player, ['glowLantern']);
    placeOnTile(player, 5, 2);

    collectPearls(world, activeRacers(world));

    expect(eventsIn(log)).toEqual([{ type: 'pearl.collected', id: 'player', index: 0, total: 1 }]);
  });

  it('leaves a pearl 4 tiles away', () => {
    const { world, log, player } = playerIn(PEARL_BOX);
    giveItems(player, ['glowLantern']);
    placeOnTile(player, 4, 2);

    collectPearls(world, activeRacers(world));

    expect(eventsIn(log)).toEqual([]);
  });

  it('is what reaches that far: without it a pearl 3 tiles away stays put', () => {
    const { world, log, player } = playerIn(PEARL_BOX);
    giveItems(player, ['jetFin']);
    placeOnTile(player, 5, 2);

    collectPearls(world, activeRacers(world));

    expect(eventsIn(log)).toEqual([]);
  });
});

describe('Puffer', () => {
  /** The player overlapping Tess from the left in open water, stepped once. */
  function bump(change: (world: World) => void) {
    const { world, log } = raceOn(BOX);
    placeAt(racerOf(world, 'player'), tileCentre(5, 2));
    placeAt(racerOf(world, 'tess'), { x: tileCentre(5, 2).x + 8, y: tileCentre(5, 2).y });
    change(world);
    step(world, log);
    return world.racers.map((racer) => ({ id: racer.id, body: racer.body }));
  }

  it('bumps like a racer of twice the mass', () => {
    const puffer = bump((world) => {
      giveItems(racerOf(world, 'player'), ['puffer']);
    });
    const heavy = bump((world) => {
      const player = racerOf(world, 'player');
      player.profile = { ...player.profile, mass: player.profile.mass * 2 };
    });

    expect(puffer).toEqual(heavy);
  });
});

describe('Bubble Shield', () => {
  it('changes neither swimming nor bumping', () => {
    const { world, player } = playerIn();
    const bare = modifiersFor(world, player);
    giveItems(player, ['bubbleShield']);

    expect(modifiersFor(world, player)).toEqual(bare);
    expect(bumpMass(player)).toBe(player.profile.mass);
  });
});

describe('statuses', () => {
  it('scale swim force: boost by 1.2, ink by 0.5, inflation by 0.8, together with Jet Fins', () => {
    const { world, player } = playerIn();
    const forceWith = (status: Partial<typeof player.status>, kinds: PowerUpKind[] = []) => {
      giveItems(player, kinds);
      player.status = { ...player.status, boost: 0, slowed: 0, inflated: 0, ...status };
      return modifiersFor(world, player).forceMul;
    };

    expect(forceWith({ boost: 5 })).toBeCloseTo(1.2, 9);
    expect(forceWith({ slowed: 5 })).toBeCloseTo(0.5, 9);
    expect(forceWith({ inflated: 5 })).toBeCloseTo(0.8, 9);
    expect(forceWith({ boost: 5 }, ['jetFin'])).toBeCloseTo(1.15 * 1.2, 9);
  });
});
