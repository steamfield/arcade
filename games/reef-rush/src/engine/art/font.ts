/**
 * The one way scenes draw text: labels in the UI kit's two hand-drawn pixel
 * faces (`ui/typeface.ts`), each with a one-pixel ink shadow down and right so
 * text holds 4.5:1 contrast on any panel. Labels snap to whole pixels and scale
 * only by whole numbers, so glyphs stay crisp at every zoom. Callers get the
 * small `Label` interface rather than a Phaser object.
 */
import Phaser from 'phaser';
import { ensureFonts } from './ui/fonts.ts';
import { TEXT_SHADOW, toneCss, type UiToneName } from './ui/palette.ts';
import { DISPLAY_FACE, measureText, normalizeText, TEXT_FACE, type Typeface } from './ui/typeface.ts';

/**
 * `text` is the 5x7 face, `display` the 12 px face. The older names map onto them: `small` and
 * `medium` are text, `large` is display, `title` is display at 2x.
 */
const SIZES = {
  text: { face: TEXT_FACE, scale: 1 },
  display: { face: DISPLAY_FACE, scale: 1 },
  small: { face: TEXT_FACE, scale: 1 },
  medium: { face: TEXT_FACE, scale: 1 },
  large: { face: DISPLAY_FACE, scale: 1 },
  title: { face: DISPLAY_FACE, scale: 2 },
} as const satisfies Record<string, { face: Typeface; scale: number }>;

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
  /** CSS colour string, e.g. '#ffd23f'. Wins over `tone` when both are given. */
  color?: string;
  /** Which point of the text sits at (x, y): top-left, centre, or top-right. Defaults to 'left'. */
  align?: 'left' | 'center' | 'right';
  /** Pinned to the screen instead of scrolling with the world. HUD labels set this. */
  fixed?: boolean;
  depth?: number;
}

/** A piece of on-screen text. Setters skip work when nothing changed, so calling them every frame is cheap. */
export interface Label {
  setText(text: string): Label;
  setColor(color: string): Label;
  setVisible(visible: boolean): Label;
  destroy(): void;
}

/** Where a label sits and how it measures; fixed at creation. */
interface Layout {
  x: number;
  y: number;
  align: NonNullable<LabelOptions['align']>;
  face: Typeface;
  scale: number;
}

/** The two game objects a label draws with: the ink shadow underneath and the tinted glyphs. */
interface Layers {
  shadow: Phaser.GameObjects.BitmapText;
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
    align: options.align ?? 'left',
    face: size.face,
    scale: size.scale * (options.scale ?? 1),
  };
  const fontSize = layout.face.height * layout.scale;
  const shown = normalizeText(layout.face, text);
  // Same depth and added first, so the shadow draws under the glyphs.
  const layers: Layers = {
    shadow: scene.add.bitmapText(0, 0, layout.face.key, shown, fontSize).setTint(TEXT_SHADOW),
    glyphs: scene.add.bitmapText(0, 0, layout.face.key, shown, fontSize),
  };
  for (const object of [layers.shadow, layers.glyphs]) {
    object.setDepth(options.depth ?? 0);
    if (options.fixed) object.setScrollFactor(0);
  }
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
      layers.shadow.setText(shown);
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
      layers.shadow.setVisible(visible);
      layers.glyphs.setVisible(visible);
      return label;
    },
    destroy() {
      layers.shadow.destroy();
      layers.glyphs.destroy();
    },
  };
  return label;
}

/**
 * Puts the text's anchor point at the label's (x, y) on whole pixels. The shadow sits one glyph
 * pixel down and right, so it scales with the text.
 */
function place(layout: Layout, layers: Layers, text: string): void {
  const { width, height } = measureText(layout.face, text, layout.scale);
  const left = { left: layout.x, center: layout.x - Math.floor(width / 2), right: layout.x - width }[layout.align];
  const top = layout.align === 'center' ? layout.y - Math.floor(height / 2) : layout.y;
  layers.glyphs.setPosition(left, top);
  layers.shadow.setPosition(left + layout.scale, top + layout.scale);
}

function toColour(css: string): number {
  return Phaser.Display.Color.HexStringToColor(css).color;
}
