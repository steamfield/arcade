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
import { createMudPieView, mudPieLooks, PIE_TEXTURE, SPLAT_FADE_TICKS, SPLAT_TEXTURE } from './mud-pie-view.ts';

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

/** An image the stand-in scene added: its frame, and whether it has been destroyed. */
interface DrawnImage {
  frame: string;
  destroyed: boolean;
}

/** A stand-in for the race scene with the mud pie textures already made, recording every image added. */
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

    expect(flying).toEqual([{ frame: 'pie', destroyed: false }]);
    expect(splatted).toEqual([
      { frame: 'pie', destroyed: true },
      { frame: 'splat', destroyed: false },
    ]);
    expect(images).toEqual([
      { frame: 'pie', destroyed: true },
      { frame: 'splat', destroyed: true },
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

  it('lies on the floor where it splatted, opaque until its last second, then fading out', () => {
    const world = worldWithPie();
    stepUntil(world, landed);
    const fresh = mudPieLooks(world, false);
    stepUntil(world, (current) => (current.twists[0]?.ttl ?? 0) <= SPLAT_FADE_TICKS);
    const fading = mudPieLooks(world, false)[0]?.alpha;
    stepUntil(world, (current) => (current.twists[0]?.ttl ?? 0) <= SPLAT_FADE_TICKS / 2);
    const halfGone = mudPieLooks(world, false)[0]?.alpha;

    expect(fresh).toMatchObject([{ frame: 'splat', alpha: 1, angle: 0 }]);
    // Its art straddles the floor's top (row 5), just above it.
    expect(fresh[0]?.y).toBeGreaterThan(4 * TILE);
    expect(fresh[0]?.y).toBeLessThan(5 * TILE);
    expect([fading, halfGone]).toEqual([1, 0.5]);
  });

  it('poses only mud pies', () => {
    const world = worldWithPie();
    world.twists.push({ style: 'headwind', owner: 'tess', x: 0, y: 0, vx: 0, vy: 0, ttl: 10, phase: 0 });

    expect(mudPieLooks(world, false).map((look) => look.twist)).toEqual(
      world.twists.filter((twist) => twist.style === 'mudPie'),
    );
  });
});
