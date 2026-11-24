/**
 * Reef's ten 9x9 HUD item icons, in the item colours of `item-rows.ts` with the UI kit's light rim in
 * place of the dark outline, so they hold on the indigo panels. Boot hands them to the UI kit,
 * which draws them as frames of its shared `ui-icons` texture, named by `IconFrame`.
 */
import type { PowerUpKind } from '../../../../logic/types.ts';
import type { NamedFrame, PixelRows } from '../../../art/pixel.ts';
import { withRim } from '../../../art/ui/icons.ts';
import { IconFrame } from '../../../art/ui/keys.ts';
import { REEF_ATTACK_ICON_ROWS, ReefItemPalette } from './item-rows.ts';

/** One item's icon frame: named by `IconFrame`, in the item's palette with the HUD rim. */
const itemIcon = (kind: PowerUpKind, rows: PixelRows): NamedFrame => ({
  name: IconFrame[kind],
  palette: withRim(ReefItemPalette[kind]),
  rows,
});

/** The ten item icon frames, in the order `ui-icons` lays them out. */
export const REEF_ITEM_ICON_FRAMES: readonly NamedFrame[] = [
  // Jet Fins: a swept fin cutting the water line.
  itemIcon('jetFin', [
    '..00.....',
    '..010....',
    '..0210...',
    '.02210...',
    '.022110..',
    '0221110..',
    '01111110.',
    '333333333',
    '.........',
  ]),
  // Bubble Shield: a ring of bubble with a shine.
  itemIcon('bubbleShield', [
    '..00000..',
    '.0111110.',
    '013322210',
    '013222210',
    '012222210',
    '012222210',
    '011222110',
    '.0111110.',
    '..00000..',
  ]),
  // Puffer: a spiny round fish facing right.
  itemIcon('puffer', [
    '..3.3.3..',
    '3.00000.3',
    '.0122220.',
    '301223203',
    '.0122220.',
    '301111103',
    '.0111110.',
    '3.00000.3',
    '..3.3.3..',
  ]),
  // Ink Sac: a dark drop with a sheen.
  itemIcon('inkSac', [
    '....0....',
    '...010...',
    '...010...',
    '..01210..',
    '.0123210.',
    '.0122110.',
    '.0111110.',
    '..01110..',
    '...000...',
  ]),
  // Glow Lantern: a framed lamp with a hot core.
  itemIcon('glowLantern', [
    '...000...',
    '..00000..',
    '.0111110.',
    '.0122210.',
    '.0123210.',
    '.0122210.',
    '.0111110.',
    '..01110..',
    '...000...',
  ]),
  // The four attack kinds: a squid, a wave, a pull arrow and an octopus. Rows are shared with the world icons.
  itemIcon('homingSquid', REEF_ATTACK_ICON_ROWS.homingSquid),
  itemIcon('riptide', REEF_ATTACK_ICON_ROWS.riptide),
  itemIcon('undertow', REEF_ATTACK_ICON_ROWS.undertow),
  itemIcon('mimic', REEF_ATTACK_ICON_ROWS.mimic),
  // Cannonball: an iron ball with a lit fuse.
  itemIcon('cannonball', [
    '......3.3',
    '.......3.',
    '..00000..',
    '.0122110.',
    '012111110',
    '011111110',
    '011111110',
    '.0111110.',
    '..00000..',
  ]),
];
