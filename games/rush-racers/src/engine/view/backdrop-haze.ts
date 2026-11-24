/**
 * The backdrop's optional haze (`BackdropSpec.haze`): long thin streaks spread down the level, pinned
 * to it like the colour bands and drifting slowly sideways at their own speeds, wrapping around the
 * screen. Each streak keeps to its own row slot of level height, so streaks never overlap and the
 * haze is one even opacity over the bands (which is what the theme's contrast bands assume).
 *
 * The layout (`hazeStreaks`) and where each streak is at a tick (`hazeRects`) are pure, so they are
 * tested without a renderer; `createHaze` only draws them. The streaks are drawn in screen x and
 * level y: the graphics follow the camera vertically and not at all sideways, so the haze stays put
 * on the level as the course scrolls, and only time moves it along.
 */
import type Phaser from 'phaser';
import type { HazeSpec } from '../themes/types.ts';
import { hash, wrap } from './scatter.ts';

/** Height in px of each streak's row slot, the shortest and longest streak, and the drift speed. */
const HAZE = { slot: 12, minLength: 24, maxLength: 88, pxPerTick: 1 / 12 } as const;
/** Streaks are this thick, or `THICK` px for about a third of them. */
const THIN = 1;
const THICK = 2;

/** One haze streak: where it starts across the screen, its row in the level, its size and drift speed. */
interface HazeStreak {
  /** Left edge at tick 0, px across the screen. */
  home: number;
  /** Top edge, px down the level. */
  y: number;
  length: number;
  thickness: number;
  /** A multiple of the base drift speed. */
  speed: number;
}

/** A streak's rectangle at one tick: x across the screen, y down the level, in px. */
interface HazeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The haze for a level `levelHeight` px tall on a screen `screenWidth` px wide: one streak per row slot. */
export function hazeStreaks(levelHeight: number, screenWidth: number): HazeStreak[] {
  return Array.from({ length: Math.floor(levelHeight / HAZE.slot) }, (_, slot) => ({
    home: hash(slot, 13) * screenWidth,
    // Inside its own slot, with room for a thick streak before the next slot starts.
    y: slot * HAZE.slot + Math.floor(hash(slot, 17) * (HAZE.slot - THICK + 1)),
    length: Math.round(HAZE.minLength + hash(slot, 19) * (HAZE.maxLength - HAZE.minLength)),
    thickness: hash(slot, 23) > 0.7 ? THICK : THIN,
    speed: 0.5 + hash(slot, 29),
  }));
}

/**
 * Where each streak is at `tick`: drifted right by its speed and wrapped so it leaves the right edge
 * of the screen and comes back in from the left.
 */
export function hazeRects(streaks: readonly HazeStreak[], tick: number, screenWidth: number): HazeRect[] {
  return streaks.map((streak) => ({
    x: Math.round(
      wrap(streak.home + tick * HAZE.pxPerTick * streak.speed, screenWidth + streak.length) - streak.length,
    ),
    y: streak.y,
    width: streak.length,
    height: streak.thickness,
  }));
}

/** The haze, drawn at `depth`; `update` moves it to where it is at a tick. */
interface Haze {
  update(tick: number): void;
}

/** Adds `haze` over a level `levelHeight` px tall to `scene`, at `depth`. */
export function createHaze(scene: Phaser.Scene, levelHeight: number, haze: HazeSpec, depth: number): Haze {
  const graphics = scene.add.graphics().setScrollFactor(0, 1).setDepth(depth);
  const width = scene.cameras.main.width;
  const streaks = hazeStreaks(levelHeight, width);
  let drawn = '';

  return {
    update(tick) {
      const rects = hazeRects(streaks, tick, width);
      // Streaks move a pixel every several ticks; redraw only when one has.
      const key = rects.map((rect) => rect.x).join(',');
      if (key === drawn) return;
      drawn = key;
      graphics.clear();
      graphics.fillStyle(haze.colour, haze.alpha);
      for (const rect of rects) graphics.fillRect(rect.x, rect.y, rect.width, rect.height);
    },
  };
}
