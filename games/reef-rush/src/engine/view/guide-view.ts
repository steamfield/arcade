/**
 * Draws the Easy guide's arrow: a sun-yellow arrow just in front of the player, pointing the way
 * on, that fades in when `hints.ts` says the player is stuck and out as soon as they make headway.
 * The placement is pure (`arrowPlacement`) so it can be tested without a renderer: which of the two
 * drawn frames to use and how far to turn it (quarter turns only, so the pixels stay crisp), where
 * it sits, and a gentle outward bob that reduced motion turns off. It is clamped into the play area
 * between the HUD row and the bottom margin, so it never covers the HUD, and kept out of the centre
 * splash's band (the countdown, GO and FINAL STRETCH banners) by dropping below it.
 */
import type Phaser from 'phaser';
import { playerOf } from '../../logic/racers.ts';
import type { Vec, World } from '../../logic/types.ts';
import { Frame, Tex } from '../art/keys.ts';
import { GUIDE_SIZE } from '../art/sprites/guide.ts';
import { Layer } from './layers.ts';
import { SPLASH_RECT } from './threat-hud.ts';
import { MARKER_BOUNDS } from './threat-math.ts';

/** How far from the player's centre the arrow's centre sits at rest, px. */
const REACH = 24;
/** The most the bob pushes the arrow further out, px, and the ticks one bob takes. */
const BOB_PX = 3;
const BOB_TICKS = 40;
/** The fraction of the way to its target opacity the arrow moves each rendered frame. */
const FADE_RATE = 0.2;
const QUARTER = Math.PI / 2;

/** Quarter turns clockwise from the drawn pose, for each tile offset the guide can point along. */
const TURNS: Readonly<
  Record<string, { frame: typeof Frame.guideStraight | typeof Frame.guideDiagonal; turns: number }>
> = {
  '1,0': { frame: Frame.guideStraight, turns: 0 },
  '0,1': { frame: Frame.guideStraight, turns: 1 },
  '-1,0': { frame: Frame.guideStraight, turns: 2 },
  '0,-1': { frame: Frame.guideStraight, turns: 3 },
  '1,1': { frame: Frame.guideDiagonal, turns: 0 },
  '-1,1': { frame: Frame.guideDiagonal, turns: 1 },
  '-1,-1': { frame: Frame.guideDiagonal, turns: 2 },
  '1,-1': { frame: Frame.guideDiagonal, turns: 3 },
};

/** Where and how to draw the arrow, in screen px. */
export interface ArrowPlacement {
  x: number;
  y: number;
  frame: typeof Frame.guideStraight | typeof Frame.guideDiagonal;
  /** Radians clockwise, a multiple of a quarter turn. */
  angle: number;
}

/**
 * The arrow for a guide pointing along tile offset `dir` (each of x and y in -1, 0, 1), for a
 * player centred at screen `player` on world tick `tick`. The bob only runs without reduced motion.
 *
 * @throws {Error} When `dir` is not one of the eight offsets.
 */
export function arrowPlacement(dir: Vec, player: Vec, tick: number, reducedMotion: boolean): ArrowPlacement {
  const pose = TURNS[`${dir.x},${dir.y}`];
  if (!pose) throw new Error(`The guide can point along the 8 neighbour offsets, not (${dir.x}, ${dir.y})`);
  const unit = dir.x !== 0 && dir.y !== 0 ? Math.SQRT1_2 : 1;
  const bob = reducedMotion ? 0 : (Math.abs((tick % BOB_TICKS) - BOB_TICKS / 2) / (BOB_TICKS / 2)) * BOB_PX;
  const reach = REACH + bob;
  const half = Math.ceil(GUIDE_SIZE / 2);
  const x = clamp(player.x + dir.x * unit * reach, MARKER_BOUNDS.x + half, MARKER_BOUNDS.x + MARKER_BOUNDS.w - half);
  const y = clamp(player.y + dir.y * unit * reach, MARKER_BOUNDS.y + half, MARKER_BOUNDS.y + MARKER_BOUNDS.h - half);
  return { x, y: clearOfSplash(x, y, half), frame: pose.frame, angle: pose.turns * QUARTER };
}

/** `y`, or just under the splash band when an arrow centred at (`x`, `y`) would sit across it. */
function clearOfSplash(x: number, y: number, half: number): number {
  const across =
    x + half > SPLASH_RECT.x &&
    x - half < SPLASH_RECT.x + SPLASH_RECT.w &&
    y + half > SPLASH_RECT.y &&
    y - half < SPLASH_RECT.y + SPLASH_RECT.h;
  return across ? SPLASH_RECT.y + SPLASH_RECT.h + half : y;
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

/** The guide view; `sync` redraws it from the world and the arrow `hints.ts` wants. */
export interface GuideView {
  /** `way` is the hint's tile offset or null; `view` is the camera's world rectangle. */
  sync(world: World, way: Vec | null, view: Phaser.Geom.Rectangle): void;
}

/** Adds the arrow to `scene`, hidden until the first `sync` that has a way to show. */
export function createGuideView(scene: Phaser.Scene, reducedMotion: boolean): GuideView {
  const arrow = scene.add
    .image(0, 0, Tex.guideArrow, Frame.guideStraight)
    .setScrollFactor(0)
    .setDepth(Layer.banner)
    .setVisible(false)
    .setAlpha(0);
  /** Kept while fading out, so the arrow keeps pointing the way it was as it goes. */
  let lastWay: Vec | null = null;

  return {
    sync(world, way, view) {
      if (way) lastWay = way;
      const target = way ? 1 : 0;
      // Reduced motion swaps instead of fading.
      arrow.alpha = reducedMotion ? target : arrow.alpha + (target - arrow.alpha) * FADE_RATE;
      if (!way && arrow.alpha < 0.02) arrow.alpha = 0;
      arrow.setVisible(arrow.alpha > 0);
      if (!lastWay || !arrow.visible) return;
      const body = playerOf(world).body;
      const player = { x: body.x + body.w / 2 - view.x, y: body.y + body.h / 2 - view.y };
      const placement = arrowPlacement(lastWay, player, world.tick, reducedMotion);
      arrow.setFrame(placement.frame).setPosition(Math.round(placement.x), Math.round(placement.y));
      arrow.setRotation(placement.angle);
    },
  };
}
