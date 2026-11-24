import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../logic/events.ts';
import { BOULDER_TUNING } from '../../logic/powerups/cannonball/boulder.ts';
import { shotRules } from '../../logic/powerups/cannonball/index.ts';
import { courseFromLevel, IDLE, racerOf } from '../../logic/test-world.ts';
import { TILE } from '../../logic/types.ts';
import { createWorld, stepWorld } from '../../logic/world.ts';
import { boulderPoses, DUST_TICKS, dustLook } from './boulder-view.ts';

/** A long Thornwood floor, the rivals' starts behind the player's. */
const FLOOR = `
  ##############################
  #............................#
  #............................#
  #2.3.4.1...................F.#
  ##############################
`;

/** A racing Thornwood world with the player having just thrown a boulder to the right. */
function worldWithBoulder() {
  const world = createWorld(courseFromLevel(FLOOR, 'run', { world: 'thornwood' }), new EventLog<GameEvent>(10_000), {
    seed: 1,
  });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'player' };
  const player = racerOf(world, 'player');
  player.facing = 1;
  shotRules('boulder').fire(world, player, { x: 1, y: 0 });
  return world;
}

describe('a rolling boulder on screen', () => {
  it('keeps one key while it rolls, and turns by the distance it rolled over its radius', () => {
    const world = worldWithBoulder();
    const before = boulderPoses(world);
    for (let tick = 0; tick < 10; tick++) stepWorld(world, IDLE, TICK_DT);
    const after = boulderPoses(world);
    const rolled = (BOULDER_TUNING.rollSpeed * 10) / 60;
    const turned = (after[0]?.angle ?? 0) - (before[0]?.angle ?? 0);

    expect(before).toHaveLength(1);
    expect(after.map((pose) => pose.key)).toEqual(before.map((pose) => pose.key));
    expect((after[0]?.x ?? 0) - (before[0]?.x ?? 0)).toBeCloseTo(rolled, 6);
    expect(turned).toBeCloseTo(rolled / (TILE / 2), 6);
  });

  it('gives two boulders thrown on different ticks different keys, and draws no other shot style', () => {
    const world = worldWithBoulder();
    stepWorld(world, IDLE, TICK_DT);
    shotRules('boulder').fire(world, racerOf(world, 'player'), { x: 1, y: 0 });
    world.shots.push({ style: 'comet', owner: 'tess', x: 0, y: 0, vx: 0, vy: 0, ttl: 10, target: null, phase: 0 });
    const keys = boulderPoses(world).map((pose) => pose.key);

    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(2);
  });
});

describe('the dust where a boulder ended', () => {
  it('starts solid, fades and spreads, and is gone after its ticks', () => {
    const start = dustLook(0);
    const late = dustLook(DUST_TICKS - 1);

    expect(start).toEqual({ alpha: 1, scale: 1 });
    expect(late?.alpha).toBeLessThan(0.1);
    expect(late?.scale).toBeGreaterThan(1.5);
    expect(dustLook(DUST_TICKS)).toBeNull();
  });
});
