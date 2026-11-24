/**
 * A framed menu button: a raised panel with a centred text label when idle; a
 * gold accent panel, gold label and the cursor fin beside it when selected.
 * The fin nudges one pixel on a fixed tick rhythm (still under reduced
 * motion). It knows nothing about menus; the caller says what is selected and
 * passes the tick and the reduced-motion setting. The UI textures must already
 * be built (`buildUiTextures`, called by boot).
 */
import type Phaser from 'phaser';
import { createLabel } from '../font.ts';
import { IconFrame, UiTex } from './keys.ts';
import { cursorNudge } from './motion.ts';
import { toneCss } from './palette.ts';
import { createPanel } from './panel.ts';
import { measureText, TEXT_FACE } from './typeface.ts';

/** Button height in px: the 3 px frame, 1 px padding and the 7 px text face, top and bottom. */
export const BUTTON_HEIGHT = 15;
/** Narrowest a button gets, so a short option like "Title" still has a clear target. */
const MIN_WIDTH = 64;
/** Space between the label and each side of the frame. */
const PADDING_X = 8;
/** Gap between the cursor fin and the button's left edge. */
const CURSOR_GAP = 2;

/** Where and how a button draws; every field is optional. */
interface ButtonOptions {
  /** Width in px. Defaults to the label's width plus padding, at least 64. */
  width?: number;
  /** Pinned to the screen instead of scrolling with the world. */
  fixed?: boolean;
  depth?: number;
}

/** A drawn button. Setters skip work when nothing changed, so calling them every frame is cheap. */
export interface Button {
  setSelected(selected: boolean): Button;
  /** Moves the cursor fin for logic tick `tick`; under reduced motion it stays put. */
  animate(tick: number, reducedMotion: boolean): Button;
  setVisible(visible: boolean): Button;
  destroy(): void;
}

/** Adds an idle button centred on `x` with its top edge at `y`. */
export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  options: ButtonOptions = {},
): Button {
  const width = options.width ?? Math.max(MIN_WIDTH, measureText(TEXT_FACE, text).width + PADDING_X * 2);
  const left = Math.round(x - width / 2);
  const top = Math.round(y);
  const depth = options.depth ?? 0;
  const placement = { fixed: options.fixed ?? false, depth };
  const panel = createPanel(scene, left, top, width, BUTTON_HEIGHT, 'raised', placement);
  const label = createLabel(scene, left + Math.floor(width / 2), top + Math.floor(BUTTON_HEIGHT / 2), text, {
    ...placement,
    align: 'center',
    tone: 'foam',
  });
  const cursorX = left - CURSOR_GAP;
  // The 9 px fin centres in the 15 px button with 3 px above and below.
  const cursor = scene.add
    .image(cursorX, top + 3, UiTex.icons, IconFrame.cursorFin)
    .setOrigin(1, 0)
    .setDepth(depth)
    .setVisible(false);
  if (placement.fixed) cursor.setScrollFactor(0);
  let selected = false;
  let visible = true;

  const button: Button = {
    setSelected(next) {
      if (next === selected) return button;
      selected = next;
      panel.setStyle(next ? 'accent' : 'raised');
      label.setColor(toneCss(next ? 'sun' : 'foam'));
      cursor.setVisible(visible && next);
      return button;
    },
    animate(tick, reducedMotion) {
      cursor.setX(cursorX + cursorNudge(tick, reducedMotion));
      return button;
    },
    setVisible(next) {
      visible = next;
      panel.setVisible(next);
      label.setVisible(next);
      cursor.setVisible(next && selected);
      return button;
    },
    destroy() {
      panel.destroy();
      label.destroy();
      cursor.destroy();
    },
  };
  return button;
}
