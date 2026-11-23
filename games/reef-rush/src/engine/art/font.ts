/**
 * The one way scenes draw text: labels in the UI kit's two hand-drawn pixel
 * faces (`ui/typeface.ts`). Each label draws over an ink copy of itself from
 * the baked shadow faces: a one-pixel drop shadow on panels, or a full
 * one-pixel outline (`outline: true`) for text over the water. The ink is in
 * the texture, not a tint, so it survives renderers that ignore tint. Labels
 * snap to whole pixels and scale only by whole numbers, so glyphs stay crisp
 * at every zoom. Callers get the small `Label` interface rather than a Phaser
 * object.
 */
// Type-only, so view modules that build on labels stay importable in unit tests without a browser.
import type Phaser from 'phaser';
import { ensureFonts } from './ui/fonts.ts';
import { toneCss, type UiToneName } from './ui/palette.ts';
import {
  DISPLAY_FACE,
  DISPLAY_SHADOW_FACE,
  measureText,
  normalizeText,
  TEXT_FACE,
  TEXT_SHADOW_FACE,
  type Typeface,
} from './ui/typeface.ts';

/**
 * `text` is the 5x7 face, `display` the 12 px face. The older names map onto them: `small` and
 * `medium` are text, `large` is display, `title` is display at 2x.
 */
const TEXT = { face: TEXT_FACE, ink: TEXT_SHADOW_FACE } as const;
const DISPLAY = { face: DISPLAY_FACE, ink: DISPLAY_SHADOW_FACE } as const;
const SIZES = {
  text: { ...TEXT, scale: 1 },
  display: { ...DISPLAY, scale: 1 },
  small: { ...TEXT, scale: 1 },
  medium: { ...TEXT, scale: 1 },
  large: { ...DISPLAY, scale: 1 },
  title: { ...DISPLAY, scale: 2 },
} as const satisfies Record<string, { face: Typeface; ink: Typeface; scale: number }>;

/** Where the ink copies sit, in glyph pixels: one down-right, or all eight neighbours for an outline. */
const DROP_SHADOW = [[1, 1]] as const;
const OUTLINE = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;

/** The text sizes a label can use. */
export type LabelSize = keyof typeof SIZES;

/** How a label looks and where it is anchored; every field is optional. */
export interface LabelOptions {
  /** Defaults to 'text'. */
  size?: LabelSize;
  /** Whole-number zoom on top of the size's own scale, for splashes. Defaults to 1. */
  scale?: 1 | 2 | 3;
  /** A UI palette colour by role. Defaults to 'foam'. */
  tone?: UiToneName;
  /**
   * CSS colour string, e.g. '#ffd23f'. Wins over `tone` when both are given.
   *
   * @deprecated Use `tone`, so text stays in the UI palette and its tested contrast.
   */
  color?: string;
  /** A full 1 px ink outline instead of the drop shadow. Required for text off a panel (see UI.md). */
  outline?: boolean;
  /**
   * Which point of the text sits at (x, y): top-left, centre, or top-right, and how lines of
   * multi-line text align to each other. Defaults to 'left'.
   */
  align?: 'left' | 'center' | 'right';
  /** Pinned to the screen instead of scrolling with the world. HUD labels set this. */
  fixed?: boolean;
  depth?: number;
}

/** A piece of on-screen text. Setters skip work when nothing changed, so calling them every frame is cheap. */
export interface Label {
  setText(text: string): Label;
  /** Takes a CSS colour string; pass `toneCss(tone)` to stay in the UI palette. */
  setColor(color: string): Label;
  setVisible(visible: boolean): Label;
  /**
   * Draws the label (dx, dy) whole px away from where it was created, for slides. Offsets don't
   * accumulate: `setOffset(0, 0)` puts it back.
   */
  setOffset(dx: number, dy: number): Label;
  destroy(): void;
}

/** Where a label sits and how it measures. Only the offset changes after creation. */
interface Layout {
  x: number;
  y: number;
  /** Whole-px slide away from (x, y), set by `setOffset`. */
  dx: number;
  dy: number;
  align: NonNullable<LabelOptions['align']>;
  face: Typeface;
  scale: number;
}

/** The game objects a label draws with: ink copies underneath, each at its offset, and the tinted glyphs. */
interface Layers {
  ink: { object: Phaser.GameObjects.BitmapText; dx: number; dy: number }[];
  glyphs: Phaser.GameObjects.BitmapText;
}

/** Adds a label to `scene` at (x, y) in game pixels. */
export function createLabel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  options: LabelOptions = {},
): Label {
  ensureFonts(scene);
  const size = SIZES[options.size ?? 'text'];
  const layout: Layout = {
    x: Math.round(x),
    y: Math.round(y),
    dx: 0,
    dy: 0,
    align: options.align ?? 'left',
    face: size.face,
    scale: size.scale * (options.scale ?? 1),
  };
  const fontSize = layout.face.height * layout.scale;
  const shown = normalizeText(layout.face, text);
  const bitmap = (face: Typeface) => {
    const object = scene.add.bitmapText(0, 0, face.key, shown, fontSize).setDepth(options.depth ?? 0);
    if (options.fixed) object.setScrollFactor(0);
    if (layout.align === 'center') object.setCenterAlign();
    else if (layout.align === 'right') object.setRightAlign();
    return object;
  };
  // Same depth and added first, so the ink draws under the glyphs.
  const offsets = options.outline ? OUTLINE : DROP_SHADOW;
  const layers: Layers = {
    ink: offsets.map(([dx, dy]) => ({ object: bitmap(size.ink), dx, dy })),
    glyphs: bitmap(layout.face),
  };
  const color = options.color ?? toneCss(options.tone ?? 'foam');
  layers.glyphs.setTint(toColour(color));
  place(layout, layers, text);
  return wrap(layout, layers, text, color);
}

function wrap(layout: Layout, layers: Layers, initialText: string, initialColor: string): Label {
  let text = initialText;
  let color = initialColor;
  const label: Label = {
    setText(next) {
      if (next === text) return label;
      text = next;
      const shown = normalizeText(layout.face, next);
      for (const { object } of layers.ink) object.setText(shown);
      layers.glyphs.setText(shown);
      place(layout, layers, next);
      return label;
    },
    setColor(next) {
      if (next !== color) layers.glyphs.setTint(toColour(next));
      color = next;
      return label;
    },
    setVisible(visible) {
      for (const { object } of layers.ink) object.setVisible(visible);
      layers.glyphs.setVisible(visible);
      return label;
    },
    setOffset(dx, dy) {
      const x = Math.round(dx);
      const y = Math.round(dy);
      if (x === layout.dx && y === layout.dy) return label;
      layout.dx = x;
      layout.dy = y;
      place(layout, layers, text);
      return label;
    },
    destroy() {
      for (const { object } of layers.ink) object.destroy();
      layers.glyphs.destroy();
    },
  };
  return label;
}

/**
 * Puts the text's anchor point at the label's (x, y) on whole pixels. Ink copies sit at their
 * offsets in glyph pixels, so the shadow or outline scales with the text.
 */
function place(layout: Layout, layers: Layers, text: string): void {
  const { width, height } = measureText(layout.face, text, layout.scale);
  const x = layout.x + layout.dx;
  const y = layout.y + layout.dy;
  const left = layout.align === 'center' ? x - Math.floor(width / 2) : layout.align === 'right' ? x - width : x;
  const top = layout.align === 'center' ? y - Math.floor(height / 2) : y;
  layers.glyphs.setPosition(left, top);
  for (const { object, dx, dy } of layers.ink) object.setPosition(left + dx * layout.scale, top + dy * layout.scale);
}

function toColour(css: string): number {
  const colour = Number.parseInt(css.replace('#', ''), 16);
  if (!/^#?[0-9a-f]{6}$/i.test(css) || Number.isNaN(colour))
    throw new Error(`Label colour must be a 6-digit hex string like '#ffc53a'; got '${css}'. Use toneCss(tone).`);
  return colour;
}
