/**
 * Cloudreach's Headwind fronts (`world.twists` of style 'headwind') on the race screen, a sky theme
 * extra layer: a pale band the front's width and the sky's height, filled with wind streaks that blow
 * forward through it, and a row of chevrons on its leading edge, all moving with the front. Drawn from
 * each twist's fields alone (`powerups/twists/headwind.ts` says what they mean), so it redraws the same
 * on any frame and needs no per-twist sprite. Code-drawn global art.
 */
import type Phaser from 'phaser';
import { HEADWIND_SWEEP_TICKS, headwindSpan } from '../../logic/powerups/twists/headwind.ts';
import { TILE, type Twist } from '../../logic/types.ts';
import type { ThemeLayer } from '../themes/types.ts';
import { Layer } from './layers.ts';

/** How one front looks on one frame. */
export interface HeadwindLook {
  /** The band's left and right edges, px. */
  left: number;
  right: number;
  /** How far the streaks have blown forward through the band, px, wrapped to one streak spacing. */
  driftPx: number;
  /** The whole front's opacity, from 0 to 1: it fades in as it starts and out as its sweep ends. */
  alpha: number;
}

/** Horizontal and vertical gap between streaks, px. */
const STREAK_SPACING_X = 32;
const STREAK_SPACING_Y = 28;
const STREAK_LENGTH_PX = 18;
/** How fast streaks blow through the band, px per tick, on top of the band's own sweep. */
const STREAK_PX_PER_TICK = 3;
const STREAK_COLOUR = 0xeef4ff;
const STREAK_ALPHA = 0.7;
const BAND_COLOUR = 0xdfe9ff;
const BAND_ALPHA = 0.14;
const CHEVRON_COLOUR = 0xffffff;
const CHEVRON_SPACING_Y = 3 * TILE;
const CHEVRON_SIZE_PX = 6;
/** Ticks the front takes to fade in after it is fired, and to fade out before its sweep ends. */
const FADE_IN_TICKS = 8;
const FADE_OUT_TICKS = 20;

/**
 * How `twist` looks on this frame. The streaks blow forward with the ticks it has swept, held still
 * when `reducedMotion` is on (the band itself still sweeps, since that is where the wind is).
 */
export function headwindLook(twist: Twist, reducedMotion: boolean): HeadwindLook {
  const swept = HEADWIND_SWEEP_TICKS - twist.ttl;
  const fadeIn = Math.min(1, swept / FADE_IN_TICKS);
  const fadeOut = Math.min(1, twist.ttl / FADE_OUT_TICKS);
  return {
    ...headwindSpan(twist),
    driftPx: reducedMotion ? 0 : (swept * STREAK_PX_PER_TICK) % STREAK_SPACING_X,
    alpha: Math.max(0, Math.min(fadeIn, fadeOut)),
  };
}

/** Adds the Headwind layer to `scene` as a theme layer; it draws nothing while no front is sweeping. */
export function createHeadwindView(scene: Phaser.Scene, reducedMotion: boolean): ThemeLayer {
  const graphics = scene.add.graphics().setDepth(Layer.water + 0.5);
  return {
    sync(current) {
      graphics.clear();
      const heightPx = current.level.height * TILE;
      for (const twist of current.twists) {
        if (twist.style !== 'headwind') continue;
        drawFront(graphics, headwindLook(twist, reducedMotion), heightPx);
      }
    },
  };
}

/** The tinted band, its streaks and the chevrons on its leading edge. */
function drawFront(graphics: Phaser.GameObjects.Graphics, look: HeadwindLook, heightPx: number): void {
  const { left, right, alpha } = look;
  graphics.fillStyle(BAND_COLOUR, BAND_ALPHA * alpha);
  graphics.fillRect(left, 0, right - left, heightPx);
  drawStreaks(graphics, look, heightPx);
  graphics.lineStyle(2, CHEVRON_COLOUR, alpha);
  for (let y = CHEVRON_SPACING_Y / 2; y < heightPx; y += CHEVRON_SPACING_Y) {
    graphics.lineBetween(right - CHEVRON_SIZE_PX, y - CHEVRON_SIZE_PX, right, y);
    graphics.lineBetween(right, y, right - CHEVRON_SIZE_PX, y + CHEVRON_SIZE_PX);
  }
}

/** Short streaks on a staggered grid inside the band, shifted forward by `look.driftPx`. */
function drawStreaks(graphics: Phaser.GameObjects.Graphics, look: HeadwindLook, heightPx: number): void {
  const { left, right } = look;
  graphics.lineStyle(2, STREAK_COLOUR, STREAK_ALPHA * look.alpha);
  for (let row = 0, y = STREAK_SPACING_Y / 2; y < heightPx; row++, y += STREAK_SPACING_Y) {
    // Alternate rows sit half a spacing apart so the streaks don't line up in columns.
    const stagger = (row % 2) * (STREAK_SPACING_X / 2);
    for (let x = left - STREAK_SPACING_X + stagger + look.driftPx; x < right; x += STREAK_SPACING_X) {
      const from = Math.max(left, x);
      const to = Math.min(right, x + STREAK_LENGTH_PX);
      if (to > from) graphics.lineBetween(from, y, to, y);
    }
  }
}
