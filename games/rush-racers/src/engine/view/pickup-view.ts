/**
 * Things racers pick up, drawn from world state each frame: clams (open and ready,
 * or shut while recharging), pearls (hidden once taken), pearls a hit knocked loose
 * (drawn where logic has them) and loose power-ups that glow, drift and blink out before they expire. Loose sprites come from a pool
 * that grows only when more are in play than ever before, so steady play allocates nothing.
 */
import type Phaser from 'phaser';
import { type Level, TILE, type World } from '../../logic/types.ts';
import { Frame } from '../art/keys.ts';
import type { ObjectSkin } from '../worlds/object-skin.ts';
import type { WorldSkin } from '../worlds/types.ts';
import { Layer } from './layers.ts';

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

/**
 * Adds clam, pearl and loose-pickup sprites for `level` to `scene`, drawn with `skin`. Under
 * `reducedMotion` loose pickups sit still and glow steadily.
 */
export function createPickupView(
  scene: Phaser.Scene,
  level: Level,
  skin: WorldSkin,
  reducedMotion: boolean,
): PickupView {
  const { objects } = skin;
  const { pickups: pickupArt, itemTextures } = objects;
  const clams = level.clams.map((tile) =>
    scene.add.image(centre(tile.x), centre(tile.y), pickupArt.clam, Frame.clamOpen).setDepth(Layer.objects),
  );
  const pearls = level.pearls.map((tile) =>
    scene.add.image(centre(tile.x), centre(tile.y), pickupArt.pearl, Frame.a).setDepth(Layer.objects),
  );
  const loose: LooseSprite[] = [];
  const loosePearls: Phaser.GameObjects.Image[] = [];

  return {
    sync(world, tick) {
      world.clams.forEach(({ closedFor }, index) => {
        clams[index]?.setFrame(closedFor > 0 ? Frame.clamClosed : Frame.clamOpen);
      });
      pearls.forEach((pearl, index) => {
        pearl.setVisible(!world.pearlsTaken.has(index));
      });
      world.loose.forEach((pickup, index) => {
        loose[index] ??= addLooseSprite(scene, objects);
        showLoose(loose[index], pickup, itemTextures, tick, reducedMotion);
      });
      for (let index = world.loose.length; index < loose.length; index++) hideLoose(loose[index] as LooseSprite);
      world.loosePearls.forEach((pearl, index) => {
        loosePearls[index] ??= scene.add.image(0, 0, pickupArt.pearl, Frame.a).setDepth(Layer.objects);
        loosePearls[index].setPosition(Math.round(pearl.at.x), Math.round(pearl.at.y)).setVisible(true);
      });
      for (let index = world.loosePearls.length; index < loosePearls.length; index++)
        loosePearls[index]?.setVisible(false);
    },
  };
}

function addLooseSprite(scene: Phaser.Scene, objects: ObjectSkin): LooseSprite {
  return {
    glow: scene.add.image(0, 0, objects.attack.looseGlow, Frame.a).setDepth(Layer.objects),
    // Any item texture will do: `showLoose` sets the real one before the sprite is shown.
    icon: scene.add.image(0, 0, objects.itemTextures.jetFin, Frame.a).setDepth(Layer.objects),
  };
}

function showLoose(
  { glow, icon }: LooseSprite,
  pickup: World['loose'][number],
  itemTextures: ObjectSkin['itemTextures'],
  tick: number,
  reducedMotion: boolean,
): void {
  const wave = reducedMotion ? 0 : Math.sin((2 * Math.PI * tick) / BOB_PERIOD_TICKS);
  const bob = Math.round(wave * BOB_PX);
  const x = Math.round(pickup.x);
  const y = Math.round(pickup.y) + bob;
  const blinkedOut = pickup.ttl < BLINK_TICKS && pickup.ttl % BLINK_PERIOD < BLINK_PERIOD / 2;
  const alpha = pickup.grabDelay > 0 ? UNGRABBABLE_ALPHA : 1;
  icon.setTexture(itemTextures[pickup.kind], Frame.a).setPosition(x, y).setAlpha(alpha).setVisible(!blinkedOut);
  glow
    .setPosition(x, y)
    .setScale(LOOSE_GLOW_SCALE)
    .setAlpha(alpha * (0.6 + 0.4 * wave))
    .setVisible(!blinkedOut);
}

function hideLoose({ glow, icon }: LooseSprite): void {
  glow.setVisible(false);
  icon.setVisible(false);
}

function centre(tile: number): number {
  return tile * TILE + TILE / 2;
}
