import { describe, expect, it } from 'vitest';
import { applyHit } from '../hazards/hits.ts';
import { centreOf } from '../racers.ts';
import { eventsIn, raceOn, racerOf } from '../test-world.ts';
import { gainPowerUp, popForHit } from './stack.ts';

/** Open water: these tests call the stack rules directly and never step. */
const BOX = `
  ############
  #1........F#
  #2........F#
  #3........F#
  #4........F#
  ############
`;

function setup() {
  const { world, log } = raceOn(BOX);
  const player = racerOf(world, 'player');
  /** An urchin-style hit from just left of the player's centre. */
  const hit = () => applyHit(world, player, 'urchin', null, { x: centreOf(player).x - 8, y: centreOf(player).y });
  return { world, log, player, hit };
}

describe('gaining power-ups', () => {
  it('puts each new power-up on top of the stack', () => {
    const { world, log, player } = setup();

    expect(gainPowerUp(world, player, 'jetFin')).toBe(true);
    expect(gainPowerUp(world, player, 'puffer')).toBe(true);

    expect(player.stack).toEqual(['jetFin', 'puffer']);
    expect(eventsIn(log)).toEqual([
      { type: 'powerup.gained', id: 'player', kind: 'jetFin' },
      { type: 'powerup.gained', id: 'player', kind: 'puffer' },
    ]);
  });

  it('drops the oldest power-up when a fourth arrives', () => {
    const { world, log, player } = setup();
    for (const kind of ['jetFin', 'puffer', 'inkSac'] as const) gainPowerUp(world, player, kind);

    gainPowerUp(world, player, 'glowLantern');

    expect(player.stack).toEqual(['puffer', 'inkSac', 'glowLantern']);
    expect(eventsIn(log).slice(3)).toEqual([
      { type: 'powerup.lost', id: 'player', kind: 'jetFin', cause: 'full' },
      { type: 'powerup.gained', id: 'player', kind: 'glowLantern' },
    ]);
  });

  it('never gains a kind it already holds', () => {
    const { world, log, player } = setup();
    gainPowerUp(world, player, 'inkSac');
    gainPowerUp(world, player, 'jetFin');

    expect(gainPowerUp(world, player, 'inkSac')).toBe(false);

    expect(player.stack).toEqual(['inkSac', 'jetFin']);
    expect(eventsIn(log)).toHaveLength(2);
  });
});

describe('what a hit takes', () => {
  it('pops a Bubble Shield wherever it sits and keeps the rest', () => {
    const { world, log, player, hit } = setup();
    player.stack = ['bubbleShield', 'jetFin', 'puffer'];

    expect(hit()).toBe(true);

    expect(player.stack).toEqual(['jetFin', 'puffer']);
    expect(eventsIn(log)).toEqual([
      { type: 'racer.hit', id: 'player', cause: 'urchin', by: null },
      { type: 'shield.popped', id: 'player' },
    ]);
    expect(world.loose).toEqual([]);
  });

  it('knocks off the newest power-up when there is no shield', () => {
    const { log, player, hit } = setup();
    player.stack = ['jetFin', 'puffer', 'inkSac'];

    expect(hit()).toBe(true);

    expect(player.stack).toEqual(['jetFin', 'puffer']);
    expect(eventsIn(log)).toEqual([
      { type: 'racer.hit', id: 'player', cause: 'urchin', by: null },
      { type: 'powerup.lost', id: 'player', kind: 'inkSac', cause: 'hit' },
      { type: 'loose.spawned', kind: 'inkSac' },
    ]);
  });
});

describe('a hit during a dash', () => {
  it('stops only the dash combos whose pair it breaks', () => {
    const { world, player } = setup();
    player.stack = ['jetFin', 'inkSac', 'glowLantern'];
    player.dashCombos = ['inkTrail', 'comet'];

    expect(popForHit(world, player)).toBe('glowLantern');

    expect(player.dashCombos).toEqual(['inkTrail']);
  });
});
