/**
 * The shape every sprite family file exports: a texture key and its frames, each named and
 * coloured. `sheet` covers the common case of one palette for every frame. Global art keys its
 * sheets by `TexKey`; a world or theme keys its own sheets by its own key type.
 */
import type { TexKey } from '../keys.ts';
import type { NamedFrame, Palette, PixelRows } from '../pixel.ts';

/** One texture's art: frames laid left to right in the listed order. */
export interface ArtSheet<Key extends string = TexKey> {
  key: Key;
  frames: readonly NamedFrame[];
}

/** An `ArtSheet` whose frames all share `palette`, named by the keys of `frames` in insertion order. */
export function sheet<Key extends string>(
  key: Key,
  palette: Palette,
  frames: Readonly<Record<string, PixelRows>>,
): ArtSheet<Key> {
  return { key, frames: Object.entries(frames).map(([name, rows]) => ({ name, rows, palette })) };
}
