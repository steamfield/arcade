/**
 * Things racers pick up, drawn from world state each frame: clams (open and ready,
 * or shut while recharging), pearls (hidden once taken) and loose power-ups that
 * glow, drift and blink out before they expire. Loose sprites come from a pool
 * that grows only when more are in play than ever before, so steady play allocates nothing.
 */
import type Phaser from 'phaser';
import { type Level, TILE, type World } from '../../logic/types.ts';
import { Frame, Tex } from '../art/keys.ts';
import { Layer } from './layers.ts';
import { POWER_UP_TEX } from './powerup-view.ts';

/** The course's pickups; `sync` redraws them from the world. */
export interface PickupView {
  sync(world: World, tick: number): void;
}

/** A loose pickup blinks during its last this-many ticks, and is dim while it can't be grabbed yet. */
const BLINK_TICKS = 120;
const BLINK_PERIOD = 20;
const UNGRABBABLE_ALPHA = 0.5;
const BOB_PERIOD_TICKS = 90;
const BOB_PX = 1;
const LOOSE_GLOW_SCALE = 1.4;

interface LooseSprite {
  glow: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
}

/** Adds clam, pearl and loose-pickup sprites for `level` to `scene`. */
export function createPickupView(scene: Phaser.Scene, level: Level): PickupView {
  const clams = level.clams.map((tile) =>
    scene.add.image(centre(tile.x), centre(tile.y), Tex.clam, Frame.clamOpen).setDepth(Layer.objects),
  );
  const pearls = level.pearls.map((tile) =>
    scene.add.image(centre(tile.x), centre(tile.y), Tex.pearl, Frame.a).setDepth(Layer.objects),
  );
  const loose: LooseSprite[] = [];

  return {
    sync(world, tick) {
      world.clams.forEach(({ closedFor }, index) => {
        clams[index]?.setFrame(closedFor > 0 ? Frame.clamClosed : Frame.clamOpen);
      });
      pearls.forEach((pearl, index) => {
        pearl.setVisible(!world.pearlsTaken.has(index));
      });
      world.loose.forEach((pickup, index) => {
        loose[index] ??= addLooseSprite(scene);
        showLoose(loose[index], pickup, tick);
      });
      for (const sprite of loose.slice(world.loose.length)) hideLoose(sprite);
    },
  };
}

function addLooseSprite(scene: Phaser.Scene): LooseSprite {
  return {
    glow: scene.add.image(0, 0, Tex.looseGlow, Frame.a).setDepth(Layer.objects),
    icon: scene.add.image(0, 0, Tex.jetFin, Frame.a).setDepth(Layer.objects),
  };
}

function showLoose({ glow, icon }: LooseSprite, pickup: World['loose'][number], tick: number): void {
  const bob = Math.round(Math.sin((2 * Math.PI * tick) / BOB_PERIOD_TICKS) * BOB_PX);
  const x = Math.round(pickup.x);
  const y = Math.round(pickup.y) + bob;
  const blinkedOut = pickup.ttl < BLINK_TICKS && pickup.ttl % BLINK_PERIOD < BLINK_PERIOD / 2;
  const alpha = pickup.grabDelay > 0 ? UNGRABBABLE_ALPHA : 1;
  icon.setTexture(POWER_UP_TEX[pickup.kind], Frame.a).setPosition(x, y).setAlpha(alpha).setVisible(!blinkedOut);
  glow
    .setPosition(x, y)
    .setScale(LOOSE_GLOW_SCALE)
    .setAlpha(alpha * (0.6 + 0.4 * Math.sin((2 * Math.PI * tick) / BOB_PERIOD_TICKS)))
    .setVisible(!blinkedOut);
}

function hideLoose({ glow, icon }: LooseSprite): void {
  glow.setVisible(false);
  icon.setVisible(false);
}

function centre(tile: number): number {
  return tile * TILE + TILE / 2;
}
