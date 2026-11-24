/**
 * Framed pixel panels: one 8x8 source with a 1 px ink outline, cut corners, a
 * 1 px lit edge top-left and a 1 px shaded edge bottom-right, nine-sliced to
 * any size and coloured by style (raised indigo, gold accent, sunken inset).
 * Each style and size is drawn once into its own texture and reused.
 */
import type Phaser from 'phaser';
import { drawSprite, type PixelRows } from '../pixel.ts';
import { PanelPalette, type PanelStyle } from './palette.ts';
import { nineSlice } from './slice.ts';

/** The panel source: 0 outline, 1 top-left edge, 2 fill, 3 bottom-right edge. */
export const PANEL_ROWS: PixelRows = [
  '.000000.',
  '01111120',
  '01222230',
  '01222230',
  '01222230',
  '01222230',
  '02333330',
  '.000000.',
];

/** Corner and edge thickness the slice keeps as drawn. Content sits inside it. */
export const PANEL_INSET = 3;

/** A drawn panel. Its position and size are fixed; the style can change, e.g. on selection. */
export interface Panel {
  setStyle(style: PanelStyle): Panel;
  setVisible(visible: boolean): Panel;
  destroy(): void;
}

/** Where a panel draws; both optional. */
interface PanelOptions {
  /** Pinned to the screen instead of scrolling with the world. */
  fixed?: boolean;
  depth?: number;
}

/**
 * The texture key for one style at one size.
 *
 * @throws {Error} When a size is not a whole number. Panel sizes are layout constants, never
 *   animated, and a fractional size would both blur and mint a new texture per frame.
 */
export function panelKey(style: PanelStyle, width: number, height: number): string {
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new Error(`Panel size must be whole pixels; got ${width}x${height}. Use a layout constant.`);
  }
  return `ui-panel-${style}-${width}x${height}`;
}

/**
 * Adds a `width` x `height` panel with its top-left corner at (x, y).
 *
 * @throws {Error} When the size is not whole pixels, or smaller than 6x6 (the least that fits both corners).
 */
export function createPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  style: PanelStyle,
  options: PanelOptions = {},
): Panel {
  const image = scene.add
    .image(Math.round(x), Math.round(y), ensurePanelTexture(scene, style, width, height))
    .setOrigin(0, 0)
    .setDepth(options.depth ?? 0);
  if (options.fixed) image.setScrollFactor(0);
  let current = style;
  const panel: Panel = {
    setStyle(next) {
      if (next !== current) image.setTexture(ensurePanelTexture(scene, next, width, height));
      current = next;
      return panel;
    },
    setVisible(visible) {
      image.setVisible(visible);
      return panel;
    },
    destroy() {
      image.destroy();
    },
  };
  return panel;
}

function ensurePanelTexture(scene: Phaser.Scene, style: PanelStyle, width: number, height: number): string {
  const key = panelKey(style, width, height);
  if (!scene.textures.exists(key)) {
    drawSprite(scene, key, nineSlice(PANEL_ROWS, PANEL_INSET, width, height), PanelPalette[style]);
  }
  return key;
}
