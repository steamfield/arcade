/**
 * Draws the in-race hints that `hints.ts` decides on: a short line beside the player ("PRESS [A]!"
 * with the fire control's glyph, "[B] DASH!" with the dash control's, "[⇄] SWAP!" with the
 * next-item control's) and the fire glyph pulsing
 * next to the HUD's item well while items sit unused. Text over the water is sun, outlined, and
 * sits beside the player (`besidePlayerY`), so it never covers them.
 * Glyphs are key caps on a keyboard and round buttons on a touch screen. Under reduced motion the
 * pulse holds steady instead of blinking.
 */
import type Phaser from 'phaser';
import type { World } from '../../logic/types.ts';
import { createLabel, type Label } from '../art/font.ts';
import { DISPLAY_FACE, measureText } from '../art/ui/typeface.ts';
import { localOf } from '../local-racer.ts';
import { isTouchScreen } from '../touch.ts';
import { type ActionName, actionGlyphWidth, createActionGlyph, GLYPH_SIZE } from './control-glyphs.ts';
import type { HintState } from './hints.ts';
import { Layer } from './layers.ts';
import type { ScreenLayout } from './screen-layout.ts';

/** Space between the words and the glyph. */
const PART_GAP = 3;
/** A hint dropped below the player keeps this far clear of them, and stays above the bottom margin. */
const BELOW_PLAYER = 16;
/** The glyph on the HUD sits this far right of the HUD's last piece (the pearl counter), and level with the well. */
const PULSE_GAP = 3;
const WELL_TOP = 23;
const WELL_HEIGHT = 17;
/**
 * The back link's corner (UI.md "Safe zones", the first of the layout's touch zones). A glyph that
 * would reach into it, Nib's SPACE cap beside a four-slot well, drops to just under it instead.
 */
function backLinkCorner(layout: ScreenLayout): { left: number; bottom: number } {
  const zone = layout.touchZones[0];
  if (!zone) throw new Error('The screen layout has no touch zones; the hint view needs the back link zone first');
  return { left: zone.x, bottom: zone.y + zone.h };
}
/** The glyph on the HUD blinks every this many ticks, 2 blinks a second. */
const PULSE_TICKS = 15;

/** The hint views; `sync` redraws them from the world and the hints now showing. */
interface HintView {
  /** `view` is the camera's world rectangle, to turn the player's position into a screen one. */
  sync(world: World, hints: HintState, view: Phaser.Geom.Rectangle): void;
}

/** One line of a hint: words, a glyph, more words. */
interface HintLine {
  /** Moves the whole line so it is centred on the safe column with its middle at screen y `centreY`. */
  place(centreY: number): void;
  setVisible(visible: boolean): void;
  setHighlighted(highlighted: boolean): void;
}

/**
 * Adds the hint lines and the HUD glyph to `scene`. `hudRight` is the right edge of the HUD's
 * last HUD piece (the pearl counter), so the glyph can sit just right of it; `anchorY(playerY, height)` is the rule for
 * where text of that height centres beside a player at screen y `playerY` (`besidePlayerY`).
 */
export function createHintView(
  scene: Phaser.Scene,
  reducedMotion: boolean,
  hudRight: number,
  anchorY: (playerY: number, height: number) => number,
  layout: ScreenLayout,
): HintView {
  const touch = isTouchScreen();
  const pressFire = createLine(scene, touch, 'PRESS', 'fire', '!', layout.besideX);
  const kick = createLine(scene, touch, '', 'dash', 'DASH!', layout.besideX);
  const swap = createLine(scene, touch, '', 'next', 'SWAP!', layout.besideX);
  // `hints.ts` turns on at most one of these at a time.
  const lines: readonly [HintLine, (hints: HintState) => boolean][] = [
    [pressFire, (hints) => hints.pressFire],
    [kick, (hints) => hints.kick],
    [swap, (hints) => hints.swap],
  ];
  const pulse = createActionGlyph(scene, 'fire', touch, { fixed: true, depth: Layer.hud });
  const pulseX = hudRight + PULSE_GAP;
  pulse.setPosition(pulseX, pulseTop(pulseX, pulse.width, backLinkCorner(layout)));
  pulse.setVisible(false);

  return {
    sync(world, hints, view) {
      // The local racer is the one the player steers, so the hints sit beside it.
      const body = localOf(world).body;
      const playerY = body.y + body.h / 2 - view.y;
      const centreY = clearOfSplash(anchorY(playerY, GLYPH_SIZE), playerY, layout);
      const lit = !reducedMotion && Math.floor(world.tick / PULSE_TICKS) % 2 === 1;
      for (const [line, shows] of lines) {
        const shown = shows(hints);
        line.setVisible(shown);
        line.setHighlighted(lit);
        if (shown) line.place(centreY);
      }
      pulse.setVisible(hints.pulseItems);
      pulse.setHighlighted(reducedMotion || lit);
    },
  };
}

/** The HUD glyph's top: level with the well, or under the back link when it would reach into it. */
function pulseTop(left: number, width: number, backLink: { left: number; bottom: number }): number {
  const level = WELL_TOP + Math.floor((WELL_HEIGHT - GLYPH_SIZE) / 2);
  return left + width > backLink.left ? backLink.bottom + 1 : level;
}

/**
 * Moves a hint line that would sit in the centre splash's band (the countdown, GO and FINAL STRETCH
 * banners draw there) to just under the player instead, so a banner never buries it. Applied
 * whether or not a banner is up, so the hint doesn't jump when one appears.
 */
function clearOfSplash(centreY: number, playerY: number, layout: ScreenLayout): number {
  const half = Math.ceil(GLYPH_SIZE / 2);
  const splash = layout.splashRect;
  if (centreY + half <= splash.y || centreY - half >= splash.y + splash.h) return centreY;
  return Math.min(playerY + BELOW_PLAYER + half, layout.lowest - half);
}

/** Builds a line "`before` [glyph] `after`", empty strings leaving that side out. */
function createLine(
  scene: Phaser.Scene,
  touch: boolean,
  before: string,
  action: ActionName,
  after: string,
  lineX: number,
): HintLine {
  const options = { outline: true, tone: 'sun', fixed: true, depth: Layer.banner, size: 'display' } as const;
  const words = (text: string): Label | null => (text ? createLabel(scene, 0, 0, text, options) : null);
  const head = words(before);
  const tail = words(after);
  const glyph = createActionGlyph(scene, action, touch, { fixed: true, depth: Layer.banner });
  const headWidth = before ? measureText(DISPLAY_FACE, before).width + PART_GAP : 0;
  const tailGap = after.length > 1 ? PART_GAP : 0;
  const tailWidth = after ? measureText(DISPLAY_FACE, after).width + tailGap : 0;
  const total = headWidth + actionGlyphWidth(action, touch) + tailWidth;
  const left = Math.round(lineX - total / 2);
  const wordsTop = Math.floor((GLYPH_SIZE - DISPLAY_FACE.height) / 2);
  const line: HintLine = {
    place(centreY) {
      const top = Math.round(centreY - GLYPH_SIZE / 2);
      head?.setOffset(left, top + wordsTop);
      glyph.setPosition(left + headWidth, top);
      tail?.setOffset(left + headWidth + glyph.width + tailGap, top + wordsTop);
    },
    setVisible(visible) {
      head?.setVisible(visible);
      tail?.setVisible(visible);
      glyph.setVisible(visible);
    },
    setHighlighted(highlighted) {
      glyph.setHighlighted(highlighted);
    },
  };
  line.setVisible(false);
  return line;
}
