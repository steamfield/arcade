/**
 * Everything that hurts, drawn from world state each frame: urchins and jellies in the course
 * theme's skins (jellies bobbing, greyed and still while stunned), ink clouds that fade as their time
 * runs out, bubbles in flight and the bubble around a trapped racer. Sprite pools
 * grow only when more clouds or bubbles are in play than ever before.
 */
import type Phaser from 'phaser';
import { JELLY } from '../../logic/hazards/tuning.ts';
import { type Level, RACER_IDS, TILE, type World } from '../../logic/types.ts';
import { Frame } from '../art/keys.ts';
import type { HazardSkin, Theme } from '../themes/types.ts';
import type { WorldSkin } from '../worlds/types.ts';
import { Layer } from './layers.ts';

/** The course's hazards; `sync` redraws them from the world. */
export interface HazardView {
  sync(world: World, tick: number): void;
}

/** Ink fades over its last this-many ticks. */
const INK_FADE_TICKS = 60;
const INK_MAX_ALPHA = 1;
/** The ink texture's cloud is 16 px across inside a 24x16 frame. */
const INK_TEXTURE_DIAMETER = 16;
const STUNNED_TINT = 0x7a7a8c;
const TRAP_BUBBLE_SCALE = 2.6;
/** Side to side wobble of a trapped racer's bubble, px. */
const TRAP_WOBBLE_PX = 1;
const TRAP_WOBBLE_PERIOD_TICKS = 24;

/**
 * Adds urchin and jelly sprites for `level` in the skins of `hazards` (the course theme's), and the
 * pools for transient hazards (ink and bubbles drawn with `skin`'s attack art), to `scene`.
 */
export function createHazardView(
  scene: Phaser.Scene,
  level: Level,
  hazards: Theme['hazards'],
  skin: WorldSkin,
  reducedMotion: boolean,
): HazardView {
  const { inkCloud, bubble: bubbleTexture } = skin.objects.attack;
  for (const tile of level.urchins) addHazardSprite(scene, centre(tile.x), centre(tile.y), hazards.urchin);
  const jellies = level.jellies.map((tile) => addHazardSprite(scene, centre(tile.x), centre(tile.y), hazards.jelly));
  const inks: Phaser.GameObjects.Image[] = [];
  const bubbles: Phaser.GameObjects.Image[] = [];
  const trapBubbles = RACER_IDS.map(() =>
    scene.add
      .image(0, 0, bubbleTexture, Frame.a)
      .setDepth(Layer.player + 0.5)
      .setScale(TRAP_BUBBLE_SCALE)
      .setVisible(false),
  );

  return {
    sync(world, tick) {
      world.jellies.forEach((jelly, index) => {
        const sprite = jellies[index];
        if (!sprite) return;
        const stunned = jelly.stunned > 0;
        sprite.setPosition(centre(jelly.home.x), Math.round(centre(jelly.home.y) - bobOffset(jelly.phase)));
        if (stunned) sprite.setTint(STUNNED_TINT).anims.pause();
        else sprite.clearTint().anims.resume();
      });
      world.inks.forEach((ink, index) => {
        inks[index] ??= scene.add.image(0, 0, inkCloud, Frame.a).setDepth(Layer.objects);
        const fade = Math.min(1, ink.ttl / INK_FADE_TICKS);
        inks[index]
          .setPosition(Math.round(ink.x), Math.round(ink.y))
          .setScale((ink.radius * 2) / INK_TEXTURE_DIAMETER)
          .setAlpha(INK_MAX_ALPHA * fade)
          .setVisible(true);
      });
      hideFrom(inks, world.inks.length);
      world.bubbles.forEach((bubble, index) => {
        bubbles[index] ??= scene.add.image(0, 0, bubbleTexture, Frame.a).setDepth(Layer.player + 0.5);
        bubbles[index].setPosition(Math.round(bubble.x), Math.round(bubble.y)).setScale(1.2).setVisible(true);
      });
      hideFrom(bubbles, world.bubbles.length);
      world.racers.forEach((racer, index) => {
        const trapped = racer.status.trapped > 0;
        trapBubbles[index]?.setVisible(trapped);
        if (!trapped) return;
        const wobble = reducedMotion
          ? 0
          : Math.round(Math.sin((2 * Math.PI * tick) / TRAP_WOBBLE_PERIOD_TICKS) * TRAP_WOBBLE_PX);
        trapBubbles[index]?.setPosition(
          Math.round(racer.body.x + racer.body.w / 2) + wobble,
          Math.round(racer.body.y + racer.body.h / 2),
        );
      });
    },
  };
}

/** A hazard drawn in its theme's skin at (x, y), playing its loop when it has one. */
export function addHazardSprite(
  scene: Phaser.Scene,
  x: number,
  y: number,
  skin: HazardSkin,
): Phaser.GameObjects.Sprite {
  const sprite = scene.add.sprite(x, y, skin.texture, skin.frame).setDepth(Layer.objects);
  return skin.anim === null ? sprite : sprite.play(skin.anim);
}

/**
 * A jelly's vertical offset above its home centre, from its bob phase. This mirrors
 * `jellyCentre` in `logic/hazards/jellies.ts` (up first, then down) from the shared `JELLY` numbers.
 */
function bobOffset(phase: number): number {
  return JELLY.bobAmplitude * Math.sin((2 * Math.PI * phase) / JELLY.cycleTicks);
}

function hideFrom(sprites: Phaser.GameObjects.Image[], liveCount: number): void {
  for (let index = liveCount; index < sprites.length; index++) sprites[index]?.setVisible(false);
}

function centre(tile: number): number {
  return tile * TILE + TILE / 2;
}
