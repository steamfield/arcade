/**
 * The one way scenes draw text. Labels are monospace Phaser Text for now; phase
 * 4 swaps in a pixel font behind the same `createLabel` signature, which is why
 * callers get the small `Label` interface rather than a Phaser object.
 */
import type Phaser from 'phaser';

/** Text sizes in game pixels at 1x. */
const SIZE_PX = { small: 8, medium: 10, large: 16, title: 24 } as const;

/** The text sizes a label can use. */
export type LabelSize = keyof typeof SIZE_PX;

/** How a label looks and where it is anchored; every field is optional. */
export interface LabelOptions {
  size?: LabelSize;
  /** CSS colour string, e.g. '#ffd23f'. Defaults to white. */
  color?: string;
  /** Which point of the text sits at (x, y). Defaults to 'left' (top-left corner). */
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

const ORIGIN_X = { left: 0, center: 0.5, right: 1 } as const;
const OUTLINE = '#0b1d33';

/** Adds a label to `scene` at (x, y) in game pixels. */
export function createLabel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  options: LabelOptions = {},
): Label {
  const color = options.color ?? '#ffffff';
  const align = options.align ?? 'left';
  const object = scene.add
    .text(x, y, text, {
      fontFamily: 'monospace',
      fontSize: `${SIZE_PX[options.size ?? 'medium']}px`,
      color,
      stroke: OUTLINE,
      strokeThickness: 2,
      align,
    })
    .setOrigin(ORIGIN_X[align], align === 'center' ? 0.5 : 0)
    .setDepth(options.depth ?? 0);
  if (options.fixed) object.setScrollFactor(0);
  return wrap(object, text, color);
}

function wrap(object: Phaser.GameObjects.Text, initialText: string, initialColor: string): Label {
  let text = initialText;
  let color = initialColor;
  const label: Label = {
    setText(next) {
      // Phaser re-rasterizes and re-uploads the texture on every setText, so skip repeats.
      if (next !== text) object.setText(next);
      text = next;
      return label;
    },
    setColor(next) {
      if (next !== color) object.setColor(next);
      color = next;
      return label;
    },
    setVisible(visible) {
      object.setVisible(visible);
      return label;
    },
    destroy() {
      object.destroy();
    },
  };
  return label;
}
