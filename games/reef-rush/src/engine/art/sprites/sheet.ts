/**
 * The shape every sprite family file exports: a texture key from `keys.ts`
 * and its frames, each named and coloured. `sheet` covers the common case of
 * one palette for every frame.
 */
import type { TexKey } from '../keys.ts';
import type { NamedFrame, Palette, PixelRows } from '../pixel.ts';

/** One texture's art: frames laid left to right in the listed order. */
export interface ArtSheet {
  key: TexKey;
  frames: readonly NamedFrame[];
}

/** An `ArtSheet` whose frames all share `palette`, named by the keys of `frames` in insertion order. */
export function sheet(key: TexKey, palette: Palette, frames: Readonly<Record<string, PixelRows>>): ArtSheet {
  return { key, frames: Object.entries(frames).map(([name, rows]) => ({ name, rows, palette })) };
}
