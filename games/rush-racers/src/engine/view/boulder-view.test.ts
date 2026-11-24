/**
 * The boulder layer: poses read from world state, and a stone and dust puff per boulder drawn into a
 * stand-in scene that records the images added, so a test can see what a frame would draw.
 */
import { EventLog, TICK_DT } from '@arcade/core';
import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../logic/events.ts';
import { BOULDER_TUNING } from '../../logic/powerups/cannonball/boulder.ts';
import { shotRules } from '../../logic/powerups/cannonball/index.ts';
import { courseFromLevel, hold, IDLE, racerOf } from '../../logic/test-world.ts';
import { TILE, type World } from '../../logic/types.ts';
import { createWorld, stepWorld } from '../../logic/world.ts';
import { BOULDER_TEXTURE, boulderPoses, createBoulderView, DUST_TICKS, dustLook } from './boulder-view.ts';

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

/** The player one tile from the finish, the rivals' starts on a ledge overhead where no boulder reaches them. */
const FINISH_AHEAD = `
  ##############################
  #2.3.4.......................#
  #######......................#
  #..........................1F#
  ##############################
`;

/** An image the stand-in scene added: its frame, and whether it has been destroyed. */
interface DrawnImage {
  frame: string;
  destroyed: boolean;
}

/** A stand-in for the race scene with the boulder texture already made, recording every image added. */
function recordingScene(): { scene: Phaser.Scene; images: DrawnImage[] } {
  const images: DrawnImage[] = [];
  const add = {
    image(_x: number, _y: number, _texture: string, frame: string) {
      const drawn: DrawnImage = { frame, destroyed: false };
      images.push(drawn);
      const sprite = {
        setDepth: () => sprite,
        setPosition: () => sprite,
        setRotation: () => sprite,
        setAlpha: () => sprite,
        setScale: () => sprite,
        destroy: () => {
          drawn.destroyed = true;
        },
      };
      return sprite;
    },
  };
  const textures = { exists: (key: string) => key === BOULDER_TEXTURE };
  return { scene: { add, textures } as unknown as Phaser.Scene, images };
}

/** A racing Thornwood world on FINISH_AHEAD, the player having just thrown a boulder back to the left. */
function worldWithBoulderBehind(): World {
  const world = createWorld(
    courseFromLevel(FINISH_AHEAD, 'run', { world: 'thornwood' }),
    new EventLog<GameEvent>(10_000),
    { seed: 1 },
  );
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'player' };
  for (const racer of world.racers) if (racer.id !== 'player') racer.status.stunned = 10_000;
  const player = racerOf(world, 'player');
  player.facing = -1;
  shotRules('boulder').fire(world, player, { x: -1, y: 0 });
  return world;
}

describe('the boulder layer', () => {
  it('keeps drawing a boulder still in flight when the race finishes, with one stone and no dust', () => {
    const world = worldWithBoulderBehind();
    const { scene, images } = recordingScene();
    const layer = createBoulderView(scene, world);
    for (let tick = 0; tick < 60; tick++) {
      stepWorld(world, hold({ x: 1, y: 0 }), TICK_DT);
      layer.sync(world);
    }

    expect(world.race.phase).toBe('finished');
    expect(world.shots).toHaveLength(1);
    expect(images.filter((image) => image.frame === 'dust')).toEqual([]);
    expect(images).toEqual([{ frame: 'stone', destroyed: false }]);
  });

  it('swaps the stone for a puff of dust when the boulder ends', () => {
    const world = worldWithBoulderBehind();
    const { scene, images } = recordingScene();
    const layer = createBoulderView(scene, world);
    for (let tick = 0; tick < BOULDER_TUNING.ttlTicks && world.shots.length > 0; tick++) {
      stepWorld(world, IDLE, TICK_DT);
      layer.sync(world);
    }

    expect(world.shots).toEqual([]);
    expect(images).toEqual([
      { frame: 'stone', destroyed: true },
      { frame: 'dust', destroyed: false },
    ]);
  });
});

describe('a rolling boulder on screen', () => {
  it('stays the same boulder while it rolls, and turns by the distance it rolled over its radius', () => {
    const world = worldWithBoulder();
    const before = boulderPoses(world);
    for (let tick = 0; tick < 10; tick++) stepWorld(world, IDLE, TICK_DT);
    const after = boulderPoses(world);
    const rolled = (BOULDER_TUNING.rollSpeed * 10) / 60;
    const turned = (after[0]?.angle ?? 0) - (before[0]?.angle ?? 0);

    expect(before).toHaveLength(1);
    expect(after.map((pose) => pose.shot)).toEqual(before.map((pose) => pose.shot));
    expect((after[0]?.x ?? 0) - (before[0]?.x ?? 0)).toBeCloseTo(rolled, 6);
    expect(turned).toBeCloseTo(rolled / (TILE / 2), 6);
  });

  it('poses each boulder in flight once, and no other shot style', () => {
    const world = worldWithBoulder();
    stepWorld(world, IDLE, TICK_DT);
    shotRules('boulder').fire(world, racerOf(world, 'player'), { x: 1, y: 0 });
    world.shots.push({ style: 'comet', owner: 'tess', x: 0, y: 0, vx: 0, vy: 0, ttl: 10, target: null, phase: 0 });
    const shots = boulderPoses(world).map((pose) => pose.shot);

    expect(shots).toEqual(world.shots.filter((shot) => shot.style === 'boulder'));
    expect(shots).toHaveLength(2);
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
