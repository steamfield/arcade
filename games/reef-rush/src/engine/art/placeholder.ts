/**
 * Turns flat-shape descriptions into textures at boot. Each sheet is a row of
 * same-sized frames drawn with Graphics, baked with `generateTexture` and then
 * sliced into named frames, so views use real frame names long before the
 * pixel art exists.
 */
import type Phaser from 'phaser';
import type { TexKey } from './keys.ts';

/** One filled shape in frame-local pixels. `alpha` defaults to 1. */
export type Shape =
  | { rect: readonly [x: number, y: number, w: number, h: number]; color: number; alpha?: number }
  | { circle: readonly [x: number, y: number, r: number]; color: number; alpha?: number }
  | {
      triangle: readonly [x1: number, y1: number, x2: number, y2: number, x3: number, y3: number];
      color: number;
      alpha?: number;
    };

/** A texture made of frames laid left to right, each `width` x `height`, in the listed order. */
export interface Sheet {
  key: TexKey;
  width: number;
  height: number;
  frames: Readonly<Record<string, readonly Shape[]>>;
}

/**
 * Bakes `sheet` into a texture with one named frame per entry. A key that already
 * exists is left alone, so loaded art under the same key wins over the placeholder.
 */
export function drawSheet(scene: Phaser.Scene, sheet: Sheet): void {
  if (scene.textures.exists(sheet.key)) return;
  const names = Object.keys(sheet.frames);
  const graphics = scene.make.graphics({}, false);
  names.forEach((name, index) => {
    for (const shape of sheet.frames[name] ?? []) drawShape(graphics, shape, index * sheet.width);
  });
  graphics.generateTexture(sheet.key, sheet.width * names.length, sheet.height);
  graphics.destroy();

  const texture = scene.textures.get(sheet.key);
  names.forEach((name, index) => {
    texture.add(name, 0, index * sheet.width, 0, sheet.width, sheet.height);
  });
}

function drawShape(graphics: Phaser.GameObjects.Graphics, shape: Shape, offsetX: number): void {
  graphics.fillStyle(shape.color, shape.alpha ?? 1);
  if ('rect' in shape) {
    const [x, y, w, h] = shape.rect;
    graphics.fillRect(offsetX + x, y, w, h);
  } else if ('circle' in shape) {
    const [x, y, r] = shape.circle;
    graphics.fillCircle(offsetX + x, y, r);
  } else {
    const [x1, y1, x2, y2, x3, y3] = shape.triangle;
    graphics.fillTriangle(offsetX + x1, y1, offsetX + x2, y2, offsetX + x3, y3);
  }
}
