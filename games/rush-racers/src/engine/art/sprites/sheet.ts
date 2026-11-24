/**
 * The shape every sprite family file exports: a texture key and its frames, each named and
 * coloured. `sheet` covers the common case of one palette for every frame. Global art keys its
 * sheets by `TexKey`; a world or theme keys its own sheets by its own key type.
 */
import type { CharacterId } from '../../../logic/types.ts';
import { CHARACTER_IDS } from '../../../logic/types.ts';
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

/**
 * One frame per character slot, in `CHARACTER_IDS` order: named by `names`, coloured by that slot's
 * palette, drawn from `rowsOf(slot)`. Every world's portrait and head sheets have this shape.
 */
export function castFrames(
  names: Readonly<Record<CharacterId, string>>,
  palettes: Readonly<Record<CharacterId, Palette>>,
  rowsOf: (character: CharacterId) => PixelRows,
): NamedFrame[] {
  return CHARACTER_IDS.map((character) => ({
    name: names[character],
    palette: palettes[character],
    rows: rowsOf(character),
  }));
}
