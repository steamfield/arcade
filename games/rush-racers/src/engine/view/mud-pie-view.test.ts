/**
 * The mud pie layer: looks read from world state as a real Thornwood race plays a thrown pie out,
 * and the sprites drawn into a stand-in scene that records the images added, so a test can see what
 * a frame would draw.
 */
import { EventLog, TICK_DT } from '@arcade/core';
import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../logic/events.ts';
import { twistRules } from '../../logic/powerups/twists/index.ts';
import { MUD_PIE_TUNING } from '../../logic/powerups/twists/mud-pie.ts';
import { courseFromLevel, IDLE, racerOf } from '../../logic/test-world.ts';
import { TILE, type World } from '../../logic/types.ts';
import { createWorld, stepWorld } from '../../logic/world.ts';
import {
  createMudPieView,
  mudPieLooks,
  PIE_TEXTURE,
  SPLAT_FADE_TICKS,
  SPLAT_MIN_SCALE,
  SPLAT_TEXTURE,
} from './mud-pie-view.ts';

/** A long Thornwood floor at row 5, the rivals' starts behind the player's. */
const FLOOR = `
  ##############################
  #............................#
  #............................#
  #............................#
  #2.3.4.1...................F.#
  ##############################
`;

/** A racing Thornwood world with the player having just thrown a mud pie to the right. */
function worldWithPie(): World {
  const world = createWorld(courseFromLevel(FLOOR, 'run', { world: 'thornwood' }), new EventLog<GameEvent>(10_000), {
    seed: 1,
  });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'player' };
  for (const racer of world.racers) if (racer.id !== 'player') racer.status.stunned = 10_000;
  const player = racerOf(world, 'player');
  player.facing = 1;
  twistRules('mudPie').fire(world, player, { x: 1, y: 0 });
  return world;
}

/** Steps `world` idle until `done` holds, syncing `sync` after each tick, at most 600 ticks. */
function stepUntil(world: World, done: (world: World) => boolean, sync: (world: World) => void = () => {}): void {
  for (let tick = 0; tick < 600 && !done(world); tick++) {
    stepWorld(world, IDLE, TICK_DT);
    sync(world);
  }
}

const landed = (world: World) => world.twists.every((twist) => twist.phase !== 0);
const dried = (world: World) => world.twists.length === 0;

/** An image the stand-in scene added: its frame, whether it has been destroyed, and the last scale it was given. */
interface DrawnImage {
  frame: string;
  destroyed: boolean;
  scale: number;
}

/** A stand-in for the race scene with the mud pie textures already made, recording every image added. */
function recordingScene(): { scene: Phaser.Scene; images: DrawnImage[] } {
  const images: DrawnImage[] = [];
  const add = {
    image(_x: number, _y: number, _texture: string, frame: string) {
      const drawn: DrawnImage = { frame, destroyed: false, scale: 1 };
      images.push(drawn);
      const sprite = {
        setDepth: () => sprite,
        setPosition: () => sprite,
        setRotation: () => sprite,
        setAlpha: () => sprite,
        setScale: (scale: number) => {
          drawn.scale = scale;
          return sprite;
        },
        destroy: () => {
          drawn.destroyed = true;
        },
      };
      return sprite;
    },
  };
  const textures = { exists: (key: string) => key === PIE_TEXTURE || key === SPLAT_TEXTURE };
  return { scene: { add, textures } as unknown as Phaser.Scene, images };
}

describe('the mud pie layer', () => {
  it('draws the pie in flight, swaps it for a patch when it splats and removes the patch when it dries', () => {
    const world = worldWithPie();
    const { scene, images } = recordingScene();
    const layer = createMudPieView(scene, false);
    layer.sync(world);
    const flying = images.map((image) => ({ ...image }));
    stepUntil(world, landed, (current) => layer.sync(current));
    const splatted = images.map((image) => ({ ...image }));
    stepUntil(world, dried, (current) => layer.sync(current));

    expect(flying).toEqual([{ frame: 'pie', destroyed: false, scale: 1 }]);
    expect(splatted).toEqual([
      { frame: 'pie', destroyed: true, scale: 1 },
      { frame: 'splat', destroyed: false, scale: 1 },
    ]);
    // Shrunk to its smallest on the last frame before it dried.
    expect(images).toEqual([
      { frame: 'pie', destroyed: true, scale: 1 },
      { frame: 'splat', destroyed: true, scale: SPLAT_MIN_SCALE },
    ]);
  });
});

describe('a mud pie on screen', () => {
  it('tumbles while it flies, and holds still with reduced motion', () => {
    const world = worldWithPie();
    const before = mudPieLooks(world, false)[0];
    for (let tick = 0; tick < 5; tick++) stepWorld(world, IDLE, TICK_DT);
    const after = mudPieLooks(world, false)[0];

    expect(after?.frame).toBe('pie');
    expect((after?.angle ?? 0) - (before?.angle ?? 0)).toBeCloseTo(
      ((after?.x ?? 0) - (before?.x ?? 0)) / (MUD_PIE_TUNING.size / 2),
      6,
    );
    expect(after?.angle).not.toBe(before?.angle);
    expect(mudPieLooks(world, true).map((look) => look.angle)).toEqual([0]);
  });

  it('lies on the floor where it splatted, whole until its last second, then shrinking and fading out', () => {
    const world = worldWithPie();
    /** The patch's look once its ttl is down to `ticks`. */
    const lookAt = (ticks: number) => {
      stepUntil(world, (current) => (current.twists[0]?.ttl ?? 0) <= ticks);
      const look = mudPieLooks(world, false)[0];
      return { alpha: look?.alpha, scale: look?.scale, y: look?.y ?? 0 };
    };
    stepUntil(world, landed);
    const fresh = mudPieLooks(world, false);
    const starting = lookAt(SPLAT_FADE_TICKS);
    const halfGone = lookAt(SPLAT_FADE_TICKS / 2);
    const last = lookAt(6);

    expect(fresh).toMatchObject([{ frame: 'splat', alpha: 1, scale: 1, angle: 0 }]);
    // Its art straddles the floor's top (row 5), just above it.
    expect(fresh[0]?.y).toBeGreaterThan(4 * TILE);
    expect(fresh[0]?.y).toBeLessThan(5 * TILE);
    expect([starting, halfGone, last].map(({ alpha, scale }) => ({ alpha, scale }))).toEqual([
      { alpha: 1, scale: 1 },
      { alpha: 0.5, scale: 0.5 },
      { alpha: 0.1, scale: SPLAT_MIN_SCALE },
    ]);
    // Shrinking about its middle would lift it off the floor; its centre drops instead, keeping it down.
    expect(halfGone.y).toBeGreaterThan(starting.y);
    expect(last.y).toBeGreaterThan(halfGone.y);
    expect(last.y).toBeLessThan(5 * TILE);
  });

  it('poses only mud pies', () => {
    const world = worldWithPie();
    world.twists.push({ style: 'headwind', owner: 'tess', x: 0, y: 0, vx: 0, vy: 0, ttl: 10, phase: 0 });

    expect(mudPieLooks(world, false).map((look) => look.twist)).toEqual(
      world.twists.filter((twist) => twist.style === 'mudPie'),
    );
  });
});
