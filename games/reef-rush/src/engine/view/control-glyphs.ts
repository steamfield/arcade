/**
 * Pictures of the controls, drawn from kit colours and the pixel font so hints and How to Play can
 * show the button a player has to press rather than describe it. A keyboard shows key caps ("X",
 * "SPACE", the four arrows); a touch screen shows the round on-screen buttons ("A", "B") and the
 * d-pad's plus of arrows. Which one to draw is the caller's call (`isTouchScreen()`), so the same
 * hint reads right on both.
 *
 * Every glyph is a few rectangles and a label, repositioned with `setPosition`, so a hint can
 * follow the player. Highlighting swaps the gold frame in, for "this one is pressed" and for the
 * pulse; nothing here animates by itself.
 */
import type Phaser from 'phaser';
import { createLabel } from '../art/font.ts';
import { toneCss, UiColour, UiRamp } from '../art/ui/palette.ts';
import { measureText, TEXT_FACE } from '../art/ui/typeface.ts';

/** Where a glyph draws; both optional. */
export interface GlyphOptions {
  /** Pinned to the screen instead of scrolling with the world. */
  fixed?: boolean;
  depth?: number;
}

/** A drawn control glyph, top-left corner at the last `setPosition`. */
export interface Glyph {
  readonly width: number;
  readonly height: number;
  setPosition(x: number, y: number): Glyph;
  setVisible(visible: boolean): Glyph;
  /** Gold frame and letter: this control is the one to press, or is being pressed. */
  setHighlighted(highlighted: boolean): Glyph;
  destroy(): void;
}

/** The d-pad or arrow keys: four arrows, any one of which can be shown pressed. */
export interface MoveGlyph {
  readonly width: number;
  readonly height: number;
  setPosition(x: number, y: number): MoveGlyph;
  setVisible(visible: boolean): MoveGlyph;
  /** Highlights one arrow, or none. */
  setPressed(direction: Direction | null): MoveGlyph;
  destroy(): void;
}

/** The four directions of the arrows. */
export type Direction = 'up' | 'down' | 'left' | 'right';

/** The action buttons: fire (A, uses the selected item), dash (B) and next (selects the next held item). */
export type ActionName = 'fire' | 'dash' | 'next';

/** Height of a key cap and the diameter of a round button, so the two line up in a row. */
export const GLYPH_SIZE = 15;
/** Side of one arrow cap in the arrows glyph. */
const ARROW_CAP = 11;
/** Gap between arrow caps. */
const ARROW_GAP = 1;
/** Space on each side of a key cap's label. */
const CAP_PADDING = 4;
/** What each action is called on each kind of screen. */
const KEY_NAMES: Record<ActionName, { keyboard: string; touch: string }> = {
  fire: { keyboard: 'SPACE', touch: 'A' },
  dash: { keyboard: 'X', touch: 'B' },
  next: { keyboard: 'E', touch: '⇄' },
};

/** Actions whose touch button is drawn as a picture rather than a letter: the pixel font has no `⇄`. */
const DRAWN_ON_TOUCH: ReadonlySet<ActionName> = new Set(['next']);

/** The text on `action`'s control: the key on a keyboard, the button's letter on touch. */
export function controlName(action: ActionName, touch: boolean): string {
  return touch ? KEY_NAMES[action].touch : KEY_NAMES[action].keyboard;
}

/** Pixel width of `action`'s glyph, for laying a row out before drawing it. */
export function actionGlyphWidth(action: ActionName, touch: boolean): number {
  if (touch) return GLYPH_SIZE;
  return measureText(TEXT_FACE, controlName(action, false)).width + CAP_PADDING * 2 + 2;
}

/** Where and how big an action glyph draws. */
export interface ActionGlyphOptions extends GlyphOptions {
  /** Whole-number zoom, for a page that wants the control large. Defaults to 1. */
  scale?: 1 | 2;
}

/**
 * Adds `action`'s glyph: a round lettered button on touch, a key cap with the key's name otherwise.
 * `width` and `height` on the result are the drawn size, scale included.
 */
export function createActionGlyph(
  scene: Phaser.Scene,
  action: ActionName,
  touch: boolean,
  options: ActionGlyphOptions = {},
): Glyph {
  const scale = options.scale ?? 1;
  const name = controlName(action, touch);
  const baseWidth = actionGlyphWidth(action, touch);
  const width = baseWidth * scale;
  const height = GLYPH_SIZE * scale;
  const shape = createShape(scene, options).setScale(scale);
  const drawnSwap = touch && DRAWN_ON_TOUCH.has(action);
  const label = createLabel(scene, Math.floor(width / 2), Math.floor(height / 2), drawnSwap ? '' : name, {
    align: 'center',
    scale,
    fixed: options.fixed,
    depth: (options.depth ?? 0) + 0.1,
  });
  let highlighted = false;
  const draw = () => {
    shape.clear();
    if (touch) drawDisc(shape, GLYPH_SIZE, highlighted);
    else drawCap(shape, baseWidth, GLYPH_SIZE, highlighted);
    if (drawnSwap) drawSwapArrows(shape, highlighted);
    label.setColor(toneCss(highlighted ? 'sun' : 'foam'));
  };
  draw();
  const glyph: Glyph = {
    width,
    height,
    setPosition(x, y) {
      const left = Math.round(x);
      const top = Math.round(y);
      shape.setPosition(left, top);
      label.setOffset(left, top);
      return glyph;
    },
    setVisible(visible) {
      shape.setVisible(visible);
      label.setVisible(visible);
      return glyph;
    },
    setHighlighted(next) {
      if (next === highlighted) return glyph;
      highlighted = next;
      draw();
      return glyph;
    },
    destroy() {
      shape.destroy();
      label.destroy();
    },
  };
  return glyph;
}

/** Width and height of the arrows glyph: two rows of caps on a keyboard, three on touch (a plus). */
export function moveGlyphSize(touch: boolean): { width: number; height: number } {
  const step = ARROW_CAP + ARROW_GAP;
  return { width: step * 3 - ARROW_GAP, height: step * (touch ? 3 : 2) - ARROW_GAP };
}

/**
 * Adds the arrows: on a keyboard the arrow keys in their inverted T; on touch a plus, the shape of
 * the on-screen d-pad (up, left and right on one row under it, down below).
 */
export function createMoveGlyph(scene: Phaser.Scene, touch: boolean, options: GlyphOptions = {}): MoveGlyph {
  const shape = createShape(scene, options);
  let pressed: Direction | null = null;
  const caps = capSpots(touch);
  const draw = () => {
    shape.clear();
    for (const direction of DIRECTIONS) {
      const spot = caps[direction];
      drawCap(shape, ARROW_CAP, ARROW_CAP, pressed === direction, spot.x, spot.y);
      drawArrowHead(shape, direction, spot.x + 5, spot.y + 5, pressed === direction);
    }
  };
  draw();
  const glyph: MoveGlyph = {
    ...moveGlyphSize(touch),
    setPosition(x, y) {
      shape.setPosition(Math.round(x), Math.round(y));
      return glyph;
    },
    setVisible(visible) {
      shape.setVisible(visible);
      return glyph;
    },
    setPressed(next) {
      if (next === pressed) return glyph;
      pressed = next;
      draw();
      return glyph;
    },
    destroy() {
      shape.destroy();
    },
  };
  return glyph;
}

const DIRECTIONS: readonly Direction[] = ['up', 'left', 'down', 'right'];

/** Top-left of each arrow cap inside the glyph's box. */
function capSpots(touch: boolean): Record<Direction, { x: number; y: number }> {
  const step = ARROW_CAP + ARROW_GAP;
  // Keyboard: arrow keys, up over down in the middle with left and right beside down. Touch: the d-pad's plus.
  return touch
    ? {
        up: { x: step, y: 0 },
        left: { x: 0, y: step },
        right: { x: step * 2, y: step },
        down: { x: step, y: step * 2 },
      }
    : { up: { x: step, y: 0 }, left: { x: 0, y: step }, down: { x: step, y: step }, right: { x: step * 2, y: step } };
}

function createShape(scene: Phaser.Scene, options: GlyphOptions): Phaser.GameObjects.Graphics {
  const shape = scene.add.graphics().setDepth(options.depth ?? 0);
  if (options.fixed) shape.setScrollFactor(0);
  return shape;
}

/** A raised indigo cap with an ink outline and cut corners, gold-framed when highlighted (the kit's panel look). */
function drawCap(shape: Phaser.GameObjects.Graphics, w: number, h: number, highlighted: boolean, x = 0, y = 0): void {
  shape
    .fillStyle(UiColour.ink)
    .fillRect(x + 1, y, w - 2, h)
    .fillRect(x, y + 1, w, h - 2);
  shape.fillStyle(highlighted ? UiColour.sun : UiRamp.indigoLight).fillRect(x + 1, y + 1, w - 2, h - 2);
  shape
    .fillStyle(highlighted ? UiRamp.sunDark : UiRamp.indigoDark)
    .fillRect(x + w - 2, y + 2, 1, h - 3)
    .fillRect(x + 2, y + h - 2, w - 3, 1);
  shape.fillStyle(UiColour.indigo).fillRect(x + 2, y + 2, w - 4, h - 4);
}

/** A round button: an ink disc, a rim (foam, or gold when highlighted) and an indigo face, in whole-pixel rows. */
function drawDisc(shape: Phaser.GameObjects.Graphics, size: number, highlighted: boolean): void {
  const layers = [
    { inset: 0, colour: UiColour.ink },
    { inset: 1, colour: highlighted ? UiColour.sun : UiColour.foam },
    { inset: 2, colour: UiColour.indigo },
  ];
  for (const { inset, colour } of layers) {
    shape.fillStyle(colour);
    const diameter = size - inset * 2;
    const radius = diameter / 2;
    for (let row = 0; row < diameter; row++) {
      const dy = row + 0.5 - radius;
      const half = Math.sqrt(Math.max(0, radius * radius - dy * dy));
      const left = Math.round(radius - half);
      shape.fillRect(inset + left, inset + row, diameter - left * 2, 1);
    }
  }
}

/**
 * The touch swap button's `⇄` inside a round button: a right arrow over a left arrow, in foam (sun
 * when highlighted), matching the on-screen button's label.
 */
function drawSwapArrows(shape: Phaser.GameObjects.Graphics, highlighted: boolean): void {
  shape.fillStyle(highlighted ? UiColour.sun : UiColour.foam);
  // Right-pointing arrow on row 5: shaft x 3-9, head column x 9 rows 4-6, tip at x 10.
  shape.fillRect(3, 5, 7, 1).fillRect(9, 4, 1, 3).fillRect(10, 5, 1, 1);
  // Left-pointing arrow on row 9: shaft x 5-11, head column x 5 rows 8-10, tip at x 4.
  shape.fillRect(5, 9, 7, 1).fillRect(5, 8, 1, 3).fillRect(4, 9, 1, 1);
}

/** A 5x5 solid arrowhead pointing `direction`, centred on (cx, cy), in foam (sun when pressed). */
function drawArrowHead(
  shape: Phaser.GameObjects.Graphics,
  direction: Direction,
  cx: number,
  cy: number,
  pressed: boolean,
): void {
  shape.fillStyle(pressed ? UiColour.sun : UiColour.foam);
  for (let i = 0; i < 3; i++) {
    const length = 1 + i * 2;
    const reach = i - 1;
    const half = Math.floor(length / 2);
    if (direction === 'up') shape.fillRect(cx - half, cy + reach - 1, length, 1);
    else if (direction === 'down') shape.fillRect(cx - half, cy - reach + 1, length, 1);
    else if (direction === 'left') shape.fillRect(cx + reach - 1, cy - half, 1, length);
    else shape.fillRect(cx - reach + 1, cy - half, 1, length);
  }
}
