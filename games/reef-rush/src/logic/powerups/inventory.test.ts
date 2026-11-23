import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../events.ts';
import { applyHit } from '../hazards/hits.ts';
import { centreOf } from '../racers.ts';
import { courseFromLevel, eventsIn, giveItems, hold, raceOn, racerOf, step } from '../test-world.ts';
import { createWorld } from '../world.ts';
import { cycleSelection, gainItem, knockForHit } from './inventory.ts';

/** Open water: most tests here call the inventory rules directly. */
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

const STILL = { x: 0, y: 0 };

describe('inventory slots', () => {
  it('gives every racer three empty slots, and Nib four', () => {
    const world = createWorld(courseFromLevel(BOX), new EventLog<GameEvent>(), { seed: 1, character: 'nib' });

    expect(racerOf(world, 'player').items).toEqual([null, null, null, null]);
    expect(world.racers.filter((racer) => racer.character !== 'nib').map((racer) => racer.items)).toEqual([
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ]);
  });

  it('keeps held items in their slots when an earlier slot empties', () => {
    const { world, log, player } = setup();
    giveItems(player, [{ kind: 'inkSac', charges: 1 }, 'puffer', 'mimic']);

    step(world, log, 1, hold(STILL, { use: true }));

    expect(player.items).toEqual([null, { kind: 'puffer', charges: 2 }, { kind: 'mimic', charges: 1 }]);
  });
});

describe('gaining an item', () => {
  it('fills the first empty slot with its charges and selects it when nothing else is held', () => {
    const { world, log, player } = setup();
    // The selection stays on the slot an item was used up from when nothing else was held.
    player.selected = 2;

    expect(gainItem(world, player, 'jetFin', 3)).toBe(true);
    expect(gainItem(world, player, 'inkSac', 2)).toBe(true);

    expect(player.items).toEqual([{ kind: 'jetFin', charges: 3 }, { kind: 'inkSac', charges: 2 }, null]);
    expect(player.selected).toBe(0);
    expect(eventsIn(log)).toEqual([
      { type: 'powerup.gained', id: 'player', kind: 'jetFin', slot: 0, charges: 3 },
      { type: 'powerup.gained', id: 'player', kind: 'inkSac', slot: 1, charges: 2 },
    ]);
  });

  it('keeps the selection where it is when something is already held', () => {
    const { world, player } = setup();
    giveItems(player, [null, 'puffer'], 1);

    gainItem(world, player, 'jetFin', 3);

    expect(player.selected).toBe(1);
  });

  it('never gains a kind it already holds, and never past a full inventory', () => {
    const { world, log, player } = setup();
    giveItems(player, ['inkSac', 'jetFin']);

    expect(gainItem(world, player, 'inkSac', 3)).toBe(false);
    giveItems(player, ['inkSac', 'jetFin', 'puffer']);
    expect(gainItem(world, player, 'mimic', 1)).toBe(false);

    expect(player.items.map((item) => item?.kind)).toEqual(['inkSac', 'jetFin', 'puffer']);
    expect(eventsIn(log)).toEqual([]);
  });
});

describe('cycling the selection', () => {
  it('moves to the next and previous held slot, skipping empty ones and wrapping', () => {
    const { world, log, player } = setup();
    giveItems(player, ['jetFin', null, 'puffer']);

    cycleSelection(world, player, 1);
    const afterNext = player.selected;
    cycleSelection(world, player, 1);
    const afterWrap = player.selected;
    cycleSelection(world, player, -1);

    expect([afterNext, afterWrap, player.selected]).toEqual([2, 0, 2]);
    expect(eventsIn(log)).toEqual([
      { type: 'item.selected', id: 'player', slot: 2, kind: 'puffer' },
      { type: 'item.selected', id: 'player', slot: 0, kind: 'jetFin' },
      { type: 'item.selected', id: 'player', slot: 2, kind: 'puffer' },
    ]);
  });

  it('does nothing with no item or a single item held', () => {
    const { world, log, player } = setup();
    cycleSelection(world, player, 1);
    giveItems(player, [null, 'puffer'], 1);
    cycleSelection(world, player, -1);

    expect(player.selected).toBe(1);
    expect(eventsIn(log)).toEqual([]);
  });
});

describe('what a hit takes', () => {
  it('pops a Bubble Shield from any slot and keeps the selection and the rest', () => {
    const { world, log, player, hit } = setup();
    giveItems(player, ['jetFin', 'bubbleShield', 'puffer']);

    expect(hit()).toBe(true);

    expect(player.items).toEqual([{ kind: 'jetFin', charges: 3 }, null, { kind: 'puffer', charges: 2 }]);
    expect(player.selected).toBe(0);
    expect(eventsIn(log)).toEqual([
      { type: 'racer.hit', id: 'player', cause: 'urchin', by: null },
      { type: 'shield.popped', id: 'player' },
    ]);
    expect(world.loose).toEqual([]);
  });

  it('knocks the selected item loose with all its charges and selects the next held slot', () => {
    const { world, log, player, hit } = setup();
    giveItems(player, ['jetFin', { kind: 'inkSac', charges: 2 }, 'puffer'], 1);

    expect(hit()).toBe(true);

    expect(player.items).toEqual([{ kind: 'jetFin', charges: 3 }, null, { kind: 'puffer', charges: 2 }]);
    expect(player.selected).toBe(2);
    expect(eventsIn(log)).toEqual([
      { type: 'racer.hit', id: 'player', cause: 'urchin', by: null },
      { type: 'powerup.lost', id: 'player', kind: 'inkSac', cause: 'hit' },
      { type: 'loose.spawned', kind: 'inkSac', charges: 2 },
    ]);
    expect(world.loose.map(({ kind, charges }) => ({ kind, charges }))).toEqual([{ kind: 'inkSac', charges: 2 }]);
  });

  it('wraps the selection to the first held slot after knocking the last slot loose', () => {
    const { world, player } = setup();
    giveItems(player, ['jetFin', null, 'puffer'], 2);

    knockForHit(world, player);

    expect(player.selected).toBe(0);
  });

  it('stuns a racer holding nothing and changes no slot', () => {
    const { log, player, hit } = setup();

    expect(hit()).toBe(true);

    expect(player.items).toEqual([null, null, null]);
    expect(eventsIn(log)).toEqual([
      { type: 'racer.hit', id: 'player', cause: 'urchin', by: null },
      { type: 'racer.stunned', id: 'player' },
    ]);
  });
});
