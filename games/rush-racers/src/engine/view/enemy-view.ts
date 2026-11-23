/**
 * The enemies on the race screen: one set of sprites per enemy (body, `!`, wall hole, eel body,
 * warning bubbles, dizzy star) made once, plus pools for the pop rings and flying pearls of defeats
 * that grow only past their largest ever, so nothing is created or destroyed per frame. What each
 * shows comes from `enemy-look.ts`; this file only hears the events and moves sprites.
 */
import type { Stamped } from '@arcade/core';
import Phaser from 'phaser';
import type { Vec, World } from '../../logic/types.ts';
import { Frame, type FrameKey, Tex } from '../art/keys.ts';
import type { RuntimeEvent } from '../runtime.ts';
import { BUBBLE_COUNT, defeatBurst, EEL_BODY_PX, type EnemyLook, type EnemyMoments, enemyLook } from './enemy-look.ts';
import { Layer } from './layers.ts';

/** Draws the enemies; `onEvents` hears their bonks, defeats and pearl bursts drained on world tick `tick`. */
export interface EnemyView {
  sync(world: World): void;
  onEvents(events: readonly Stamped<RuntimeEvent>[], tick: number): void;
}

/** One enemy's sprites, made once. */
interface EnemySprites {
  body: Phaser.GameObjects.Sprite;
  alert: Phaser.GameObjects.Image;
  hole: Phaser.GameObjects.Image;
  eelBody: Phaser.GameObjects.TileSprite;
  bubbles: Phaser.GameObjects.Image[];
  dizzy: Phaser.GameObjects.Image;
}

/** A defeat whose burst is still playing. */
interface Burst {
  at: Vec;
  pearls: number;
  tick: number;
}

/** Adds sprites for every enemy in `world` to `scene`. */
export function createEnemyView(scene: Phaser.Scene, world: World, reducedMotion: boolean): EnemyView {
  const sprites = world.enemies.map(() => addEnemySprites(scene));
  const moments: EnemyMoments[] = world.enemies.map(() => ({ bonkedAt: null, defeatedAt: null }));
  const bursts: Burst[] = [];
  const rings: Phaser.GameObjects.Image[] = [];
  const pearls: Phaser.GameObjects.Image[] = [];
  let current = world;

  return {
    onEvents(events, tick) {
      for (const event of events) {
        if (event.type === 'enemy.bonked') {
          const moment = moments[event.index];
          if (moment) moment.bonkedAt = tick;
        } else if (event.type === 'enemy.defeated') {
          const moment = moments[event.index];
          const enemy = current.enemies[event.index];
          if (moment) moment.defeatedAt = tick;
          if (enemy) bursts.push({ at: { ...enemy.at }, pearls: 0, tick });
        } else if (event.type === 'pearls.burst') {
          // The burst follows its enemy's defeat on the same tick.
          const burst = bursts.findLast((candidate) => candidate.tick === tick);
          if (burst) burst.pearls = event.count;
        }
      }
    },
    sync(next) {
      current = next;
      next.enemies.forEach((enemy, index) => {
        const set = sprites[index];
        const moment = moments[index];
        if (!set || !moment) return;
        showEnemy(set, enemyLook(enemy, moment, next.tick, reducedMotion));
      });
      showBursts(scene, bursts, rings, pearls, next.tick, reducedMotion);
    },
  };
}

function addEnemySprites(scene: Phaser.Scene): EnemySprites {
  const mark = (frame: FrameKey, depth: number) =>
    scene.add.image(0, 0, Tex.enemyMark, frame).setDepth(depth).setVisible(false);
  return {
    body: scene.add
      .sprite(0, 0, Tex.shark, Frame.a)
      .setDepth(Layer.objects + 0.3)
      .setVisible(false),
    alert: mark(Frame.markAlert, Layer.racers + 0.6),
    // Over the rock tiles, under everything that swims.
    hole: mark(Frame.markHole, Layer.tiles + 0.5),
    eelBody: scene.add
      .tileSprite(0, 0, 1, EEL_BODY_PX, Tex.eelBody, Frame.a)
      .setDepth(Layer.objects + 0.2)
      .setVisible(false),
    bubbles: Array.from({ length: BUBBLE_COUNT }, () => mark(Frame.markBubble, Layer.objects + 0.1)),
    dizzy: mark(Frame.markStar, Layer.racers + 0.6),
  };
}

function showEnemy(set: EnemySprites, look: EnemyLook): void {
  const { body } = look;
  set.body.setVisible(body !== null);
  if (body) {
    set.body
      .setTexture(body.texture, body.frame)
      .setPosition(body.x, body.y)
      .setFlipX(body.flipX)
      .setRotation(body.rotation)
      .setScale(body.scaleX, body.scaleY);
    if (body.fill) set.body.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    else if (body.tint !== null) set.body.clearTint().setTint(body.tint);
    else set.body.clearTint();
  }
  place(set.alert, look.alert);
  place(set.dizzy, look.dizzy);
  set.hole.setVisible(look.hole !== null);
  if (look.hole)
    set.hole.setPosition(look.hole.x, look.hole.y).setFrame(look.hole.eyes ? Frame.markEyes : Frame.markHole);
  set.eelBody.setVisible(look.eelBody !== null);
  if (look.eelBody) {
    set.eelBody
      .setPosition(look.eelBody.x, look.eelBody.y)
      .setSize(look.eelBody.length, EEL_BODY_PX)
      .setRotation(look.eelBody.rotation);
  }
  set.bubbles.forEach((bubble, index) => {
    place(bubble, look.bubbles[index] ?? null);
  });
}

function place(image: Phaser.GameObjects.Image, at: Vec | null): void {
  image.setVisible(at !== null);
  if (at) image.setPosition(at.x, at.y);
}

/** Draws every burst still playing from the pools, growing them only past their largest ever, and drops finished ones. */
function showBursts(
  scene: Phaser.Scene,
  bursts: Burst[],
  rings: Phaser.GameObjects.Image[],
  pearls: Phaser.GameObjects.Image[],
  tick: number,
  reducedMotion: boolean,
): void {
  let ringCount = 0;
  let pearlCount = 0;
  for (let index = bursts.length - 1; index >= 0; index--) {
    const burst = bursts[index] as Burst;
    const look = defeatBurst(burst.at, burst.pearls, tick - burst.tick, reducedMotion);
    if (!look) {
      bursts.splice(index, 1);
      continue;
    }
    if (look.ring) {
      rings[ringCount] ??= scene.add.image(0, 0, Tex.enemyMark, Frame.markPop).setDepth(Layer.racers + 0.5);
      rings[ringCount]
        ?.setVisible(true)
        .setPosition(look.ring.x, look.ring.y)
        .setScale(look.ring.scale)
        .setAlpha(look.ring.alpha);
      ringCount++;
    }
    for (const pearl of look.pearls) {
      pearls[pearlCount] ??= scene.add.image(0, 0, Tex.pearl, Frame.a).setDepth(Layer.racers + 0.5);
      pearls[pearlCount]?.setVisible(true).setPosition(pearl.x, pearl.y).setAlpha(pearl.alpha);
      pearlCount++;
    }
  }
  for (let index = ringCount; index < rings.length; index++) rings[index]?.setVisible(false);
  for (let index = pearlCount; index < pearls.length; index++) pearls[index]?.setVisible(false);
}
