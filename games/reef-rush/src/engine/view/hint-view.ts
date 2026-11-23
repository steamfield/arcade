/**
 * Draws the in-race hints that `hints.ts` decides on: a short line beside the player ("PRESS B!"
 * with the burst control's glyph, "KICK!" with the kick control's) and the burst glyph pulsing next
 * to the HUD's power-up well while the stack holds something unused. Text over the water is sun,
 * outlined, and sits where the combo name does (`comboCentreY`), so it never covers the player.
 * Glyphs are key caps on a keyboard and round buttons on a touch screen. Under reduced motion the
 * pulse holds steady instead of blinking.
 */
import type Phaser from 'phaser';
import { playerOf } from '../../logic/racers.ts';
import type { World } from '../../logic/types.ts';
import { createLabel, type Label } from '../art/font.ts';
import { DISPLAY_FACE, measureText } from '../art/ui/typeface.ts';
import { isTouchScreen } from '../touch.ts';
import { type ActionName, actionGlyphWidth, createActionGlyph, GLYPH_SIZE } from './control-glyphs.ts';
import type { HintState } from './hints.ts';
import { Layer } from './layers.ts';
import { SPLASH_RECT } from './threat-hud.ts';

/** The hint line centres on x 168, the middle of the safe column, like the combo name. */
const LINE_X = 168;
/** Space between the words and the glyph. */
const PART_GAP = 3;
/** A hint dropped below the player keeps this far clear of them, and stays above the bottom margin. */
const BELOW_PLAYER = 16;
const LOWEST = 174;
/** The glyph on the HUD sits this far right of the well, and level with it. */
const PULSE_GAP = 3;
const WELL_LEFT = 66;
const WELL_TOP = 23;
const WELL_HEIGHT = 17;
/** The glyph on the HUD blinks every this many ticks, 2 blinks a second. */
const PULSE_TICKS = 15;

/** The hint views; `sync` redraws them from the world and the hints now showing. */
export interface HintView {
  /** `view` is the camera's world rectangle, to turn the player's position into a screen one. */
  sync(world: World, hints: HintState, view: Phaser.Geom.Rectangle): void;
}

/** One line of a hint: words, a glyph, more words. */
interface HintLine {
  /** Moves the whole line so it is centred on x 168 with its middle at screen y `centreY`. */
  place(centreY: number): void;
  setVisible(visible: boolean): void;
  setHighlighted(highlighted: boolean): void;
}

/**
 * Adds the hint lines and the HUD glyph to `scene`. `wellWidth` is the width of the HUD's
 * power-up well, so the glyph can sit just right of it; `anchorY(playerY, height)` is the combo
 * name's rule for where text of that height centres beside a player at screen y `playerY`.
 */
export function createHintView(
  scene: Phaser.Scene,
  reducedMotion: boolean,
  wellWidth: number,
  anchorY: (playerY: number, height: number) => number,
): HintView {
  const touch = isTouchScreen();
  const pressB = createLine(scene, touch, 'PRESS', 'burst', '!');
  const kick = createLine(scene, touch, '', 'kick', 'KICK!');
  const pulse = createActionGlyph(scene, 'burst', touch, { fixed: true, depth: Layer.hud });
  pulse.setPosition(WELL_LEFT + wellWidth + PULSE_GAP, WELL_TOP + Math.floor((WELL_HEIGHT - GLYPH_SIZE) / 2));
  pulse.setVisible(false);

  return {
    sync(world, hints, view) {
      const body = playerOf(world).body;
      const playerY = body.y + body.h / 2 - view.y;
      const centreY = clearOfSplash(anchorY(playerY, GLYPH_SIZE), playerY);
      // A kick hint outranks PRESS B: a squid on the way is the more urgent thing to do.
      const lit = !reducedMotion && Math.floor(world.tick / PULSE_TICKS) % 2 === 1;
      const showPressB = hints.pressB && !hints.kick;
      pressB.setVisible(showPressB);
      kick.setVisible(hints.kick);
      pressB.setHighlighted(lit);
      kick.setHighlighted(lit);
      if (showPressB) pressB.place(centreY);
      if (hints.kick) kick.place(centreY);
      pulse.setVisible(hints.pulseStack);
      pulse.setHighlighted(reducedMotion || lit);
    },
  };
}

/**
 * Moves a hint line that would sit in the centre splash's band (the countdown, GO and FINAL STRETCH
 * banners draw there) to just under the player instead, so a banner never buries it. Applied
 * whether or not a banner is up, so the hint doesn't jump when one appears.
 */
function clearOfSplash(centreY: number, playerY: number): number {
  const half = Math.ceil(GLYPH_SIZE / 2);
  if (centreY + half <= SPLASH_RECT.y || centreY - half >= SPLASH_RECT.y + SPLASH_RECT.h) return centreY;
  return Math.min(playerY + BELOW_PLAYER + half, LOWEST - half);
}

/** Builds a line "`before` [glyph] `after`", empty strings leaving that side out. */
function createLine(scene: Phaser.Scene, touch: boolean, before: string, action: ActionName, after: string): HintLine {
  const options = { outline: true, tone: 'sun', fixed: true, depth: Layer.banner, size: 'display' } as const;
  const words = (text: string): Label | null => (text ? createLabel(scene, 0, 0, text, options) : null);
  const head = words(before);
  const tail = words(after);
  const glyph = createActionGlyph(scene, action, touch, { fixed: true, depth: Layer.banner });
  const headWidth = before ? measureText(DISPLAY_FACE, before).width + PART_GAP : 0;
  const tailGap = after.length > 1 ? PART_GAP : 0;
  const tailWidth = after ? measureText(DISPLAY_FACE, after).width + tailGap : 0;
  const total = headWidth + actionGlyphWidth(action, touch) + tailWidth;
  const left = Math.round(LINE_X - total / 2);
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
