/**
 * Reef's ten in-world item sprites (12x12, each its own shape: fin, bubble, puffer, ink drop,
 * lantern, squid, wave, pull arrow, octopus, cannonball), shown as a loose pickup or a clam's burst.
 * The palettes and the four attack kinds' silhouettes come from `item-rows.ts`, shared with Reef's
 * HUD icons in `icons.ts`, so a kind keeps one colour and shape everywhere.
 */
import { Frame } from '../../../art/keys.ts';
import { worldIcon } from '../../../art/rows.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { ReefItemTex } from '../keys.ts';
import { REEF_ATTACK_ICON_ROWS, ReefItemPalette } from './item-rows.ts';

/** The ten in-world item sheets, one 12x12 frame `a` per item. */
export const REEF_ITEM_SHEETS: readonly ArtSheet<string>[] = [
  sheet(ReefItemTex.jetFin, ReefItemPalette.jetFin, {
    [Frame.a]: [
      '............',
      '............',
      '.000........',
      '0110000.....',
      '01211110000.',
      '011212122210',
      '011121212110',
      '012111111110',
      '01112222220.',
      '.0110000....',
      '..00........',
      '............',
    ],
  }),
  sheet(ReefItemTex.bubbleShield, ReefItemPalette.bubbleShield, {
    [Frame.a]: [
      '............',
      '...000000...',
      '..01122110..',
      '.0133222210.',
      '.0132222210.',
      '.0222222220.',
      '.0222222220.',
      '.0122222210.',
      '.0122222310.',
      '..01122110..',
      '...000000...',
      '............',
    ],
  }),
  sheet(ReefItemTex.puffer, ReefItemPalette.puffer, {
    [Frame.a]: [
      '..0..030.0..',
      '.0300000030.',
      '.0001111000.',
      '030122111030',
      '.0111111010.',
      '.0111111110.',
      '001111111100',
      '301222222103',
      '0.02222220.0',
      '...011110...',
      '...000000...',
      '..030..030..',
    ],
  }),
  sheet(ReefItemTex.inkSac, ReefItemPalette.inkSac, {
    [Frame.a]: [
      '.....00.....',
      '....0110....',
      '....0110....',
      '...011110...',
      '..01111110..',
      '.0113211110.',
      '.0112111110.',
      '.0112111110.',
      '.0111111110.',
      '..01111110..',
      '...011110...',
      '....0000....',
    ],
  }),
  sheet(ReefItemTex.glowLantern, ReefItemPalette.glowLantern, {
    [Frame.a]: [
      '............',
      '....0000....',
      '...000000...',
      '..01111110..',
      '..01223210..',
      '..01233310..',
      '..01233310..',
      '..01223210..',
      '..01111110..',
      '...011110...',
      '....0000....',
      '............',
    ],
  }),
  sheet(ReefItemTex.cannonball, ReefItemPalette.cannonball, {
    [Frame.a]: [
      '.........3..',
      '........3.3.',
      '.......0.3..',
      '...00000....',
      '..0111110...',
      '.012211110..',
      '.012111110..',
      '.011111110..',
      '.011111110..',
      '..0111110...',
      '...00000....',
      '............',
    ],
  }),
  sheet(ReefItemTex.homingSquid, ReefItemPalette.homingSquid, {
    [Frame.a]: worldIcon(REEF_ATTACK_ICON_ROWS.homingSquid),
  }),
  sheet(ReefItemTex.riptide, ReefItemPalette.riptide, { [Frame.a]: worldIcon(REEF_ATTACK_ICON_ROWS.riptide) }),
  sheet(ReefItemTex.undertow, ReefItemPalette.undertow, { [Frame.a]: worldIcon(REEF_ATTACK_ICON_ROWS.undertow) }),
  sheet(ReefItemTex.mimic, ReefItemPalette.mimic, { [Frame.a]: worldIcon(REEF_ATTACK_ICON_ROWS.mimic) }),
];
