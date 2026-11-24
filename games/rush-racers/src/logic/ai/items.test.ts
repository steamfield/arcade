/**
 * What a rival fires when it holds a Cannonball: in Cloudreach (a shot world) a Puffer opens the cloud
 * and the Meteor waits, and a shot-style Cannonball is not a dash, so it never takes the dash's damping.
 * Raced through `createWorld` and the exported `chooseItemSlot` on small inline levels.
 */
import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { itemAggressionMul } from '../difficulty-level.ts';
import type { GameEvent } from '../events.ts';
import { courseFromLevel, giveItems, placeOnTile, racerOf } from '../test-world.ts';
import type { RacerId, Vec, World } from '../types.ts';
import { createWorld } from '../world.ts';
import { chooseItemSlot, ITEM_USE } from './items.ts';

const AIM: Vec = { x: 1, y: 0 };
/** The tile row racers stand on, just over the floor. */
const STANDING_ROW = 8;

/** A one-row sky corridor 40 columns wide: open only on row 8, with the starts and a puff cloud at column `cloudAt` (if any) that fills it, walls above and below. */
function sky(cloudAt: number | null): string {
  const bottom = `#1.2.3.4${'.'.repeat(30)}F#`
    .split('')
    .map((glyph, col) => (col === cloudAt ? 'C' : glyph))
    .join('');
  const detour = `${'#'.repeat(9)}...${'#'.repeat(28)}`;
  return ['#'.repeat(40), ...Array.from({ length: 6 }, () => '#'.repeat(40)), detour, bottom, '#'.repeat(40)].join(
    '\n',
  );
}

/** A racing world in `worldId` (racing in `medium`) with `bo` on tile (8, 8), last in a field the others lead. */
function rivalWorld(worldId: string, medium: string, cloudAt: number | null) {
  const course = courseFromLevel({ name: 'items', ascii: sky(cloudAt) }, medium, { world: worldId });
  const world = createWorld(course, new EventLog<GameEvent>(100_000), { seed: 1, difficulty: 'hard' });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'everyone' };
  const places: Record<RacerId, number> = { player: 1, tess: 2, squib: 3, bo: 4 };
  for (const [id, place] of Object.entries(places) as [RacerId, number][]) {
    racerOf(world, id).place = place;
    racerOf(world, id).progress = place * 5;
  }
  const bo = racerOf(world, 'bo');
  placeOnTile(bo, 8, STANDING_ROW);
  return { world, bo };
}

/** The per-tick chance `id` fires an item that has a use, before any dash damping. */
function fireChanceOf(world: World, id: RacerId): number {
  const racer = racerOf(world, id);
  const aggression = racer.profile.itemAggression * itemAggressionMul(world, racer);
  const chance = aggression / Math.max(1, racer.profile.reactionTicks);
  if (chance <= 0) throw new Error(`${id} never fires items, so its fire chance can't be compared`);
  return chance;
}

describe('a Cloudreach rival holding a Cannonball with puff cloud ahead', () => {
  it('fires a Puffer beside it, though the Meteor has a target, because the Meteor does not open the cloud', () => {
    const { world, bo } = rivalWorld('cloudreach', 'flight', 10);
    giveItems(bo, ['cannonball', 'puffer']);

    expect(chooseItemSlot(world, bo, AIM, 0)).toBe(1);
  });

  it('fires the Meteor alone for its target, and not at all when it leads and has no one to mark above it', () => {
    const trailing = rivalWorld('cloudreach', 'flight', 10);
    giveItems(trailing.bo, ['cannonball']);
    expect(chooseItemSlot(trailing.world, trailing.bo, AIM, 0)).toBe(0);

    const leading = rivalWorld('cloudreach', 'flight', 10);
    giveItems(leading.bo, ['cannonball']);
    leading.bo.place = 1;
    expect(chooseItemSlot(leading.world, leading.bo, AIM, 0)).toBeNull();
  });
});

describe('the dash damping on a rival Cannonball', () => {
  /** Whether bo fires a lone Cannonball with no cloud ahead at a draw of `share` times its fire chance. */
  function firesAt(worldId: string, medium: string, share: number): boolean {
    const { world, bo } = rivalWorld(worldId, medium, null);
    giveItems(bo, ['cannonball']);
    return chooseItemSlot(world, bo, AIM, share * fireChanceOf(world, 'bo')) !== null;
  }

  it('does not apply to a Meteor, which fires at half the chance a use has', () => {
    expect(firesAt('cloudreach', 'flight', 0.5)).toBe(true);
  });

  it("applies to Reef's dashing Cannonball, which needs a draw under the jet chance multiplier", () => {
    expect(firesAt('reef', 'swim', 0.5)).toBe(false);
    expect(firesAt('reef', 'swim', ITEM_USE.jetChanceMul / 2)).toBe(true);
  });
});
