/**
 * Thornwood's object art: every key `keys.ts` names is built with the frames the views ask for, at
 * Reef's sizes, and the enemies and the acorn stand out from the forest's canopy.
 */
import { describe, expect, it } from 'vitest';
import { ENEMY_KINDS, POWER_UP_KINDS } from '../../../logic/types.ts';
import { measureFrames } from '../../art/pixel.ts';
import { ART_SHEETS } from '../../art/sprites/index.ts';
import type { ArtSheet } from '../../art/sprites/sheet.ts';
import { ICON_SHEETS } from '../../art/ui/icons.ts';
import { UiTex } from '../../art/ui/keys.ts';
import { ForestBackdropPalette, WOOD_BANDS } from '../../themes/forest/palettes.ts';
import { REEF_OBJECTS } from '../reef/objects.ts';
import { ThornIconFrame, ThornItemTex, ThornTex } from './keys.ts';
import { THORNWOOD_OBJECTS } from './objects.ts';
import { ATTACK_ART_SHEETS } from './sprites/attack.ts';
import { THORN_ENEMY_SHEETS, ThornEnemyPalette } from './sprites/enemies.ts';
import { ITEM_ART_SHEETS } from './sprites/items.ts';
import { THORN_MARK_SHEET, THORN_MARK_SIZE } from './sprites/marks.ts';
import { AcornPalette, THORN_PICKUP_SHEETS } from './sprites/pickups.ts';

const THORN_SHEETS: readonly ArtSheet<string>[] = [
  ...ITEM_ART_SHEETS,
  ...ATTACK_ART_SHEETS,
  ...THORN_PICKUP_SHEETS,
  ...THORN_ENEMY_SHEETS,
  THORN_MARK_SHEET,
];

const thornSheet = (key: string) => THORN_SHEETS.find((sheet) => sheet.key === key);
const reefSheet = (key: string) => ART_SHEETS.find((sheet) => sheet.key === key);
const sizeOf = (sheet: ArtSheet<string> | undefined) => measureFrames(sheet?.key ?? 'missing', sheet?.frames ?? []);
const frameNames = (sheet: ArtSheet<string> | undefined) => sheet?.frames.map((frame) => frame.name);

/** WCAG relative luminance of a 0xRRGGBB colour. */
function luminance(colour: number): number {
  const [red = 0, green = 0, blue = 0] = [16, 8, 0].map((shift) => {
    const channel = ((colour >> shift) & 0xff) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(a: number, b: number): number {
  const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('Thornwood object art', () => {
  it('draws every object texture key.ts names, once', () => {
    const wanted = [
      ...Object.values(ThornItemTex),
      ...Object.entries(ThornTex)
        .filter(([name]) => name !== 'portraits' && name !== 'heads')
        .map(([, key]) => key),
    ];
    expect(THORN_SHEETS.map((sheet) => sheet.key).sort()).toEqual(wanted.sort());
  });

  it.each(THORN_SHEETS.map((sheet) => [sheet.key, sheet] as const))('%s is well-formed pixel text', (key, sheet) => {
    expect(() => measureFrames(key, sheet.frames)).not.toThrow();
    for (const frame of sheet.frames) expect(frame.palette.length).toBeLessThanOrEqual(4);
  });

  it('gives the icon sheet one 9x9 frame per item, named as keys.ts says', () => {
    const icons = thornSheet(ThornTex.icons);
    expect(frameNames(icons)?.sort()).toEqual(POWER_UP_KINDS.map((kind) => ThornIconFrame[kind]).sort());
    const reefIcons = ICON_SHEETS.find((sheet) => sheet.key === UiTex.icons);
    expect(sizeOf(icons)).toEqual(measureFrames('reef icons', reefIcons?.frames ?? []));
  });

  const { itemTextures, attack, pickups, enemies } = THORNWOOD_OBJECTS;
  /** Every Thornwood texture paired with the Reef texture in the same slot. */
  const counterparts: [string, string][] = [
    ...POWER_UP_KINDS.map((kind): [string, string] => [itemTextures[kind], REEF_OBJECTS.itemTextures[kind]]),
    [attack.homer, REEF_OBJECTS.attack.homer],
    [attack.riptideStreak, REEF_OBJECTS.attack.riptideStreak],
    [attack.undertowStreak, REEF_OBJECTS.attack.undertowStreak],
    [attack.inkCloud, REEF_OBJECTS.attack.inkCloud],
    [attack.bubble, REEF_OBJECTS.attack.bubble],
    [attack.looseGlow, REEF_OBJECTS.attack.looseGlow],
    [pickups.pearl, REEF_OBJECTS.pickups.pearl],
    [pickups.clam, REEF_OBJECTS.pickups.clam],
    ...ENEMY_KINDS.map((kind): [string, string] => [enemies.bodies[kind], REEF_OBJECTS.enemies.bodies[kind]]),
    [enemies.eelBody, REEF_OBJECTS.enemies.eelBody],
    [enemies.marks, REEF_OBJECTS.enemies.marks],
  ];

  it.each(counterparts)("sizes %s like its Reef counterpart's %s", (thorn, reefKey) => {
    expect(sizeOf(thornSheet(thorn))).toEqual(sizeOf(reefSheet(reefKey)));
  });

  it.each(counterparts)(
    'gives %s the frames its Reef counterpart %s has, since views ask for them by name',
    (thorn, reefKey) => {
      expect(frameNames(thornSheet(thorn))).toEqual(frameNames(reefSheet(reefKey)));
    },
  );

  it('draws the marks on frames of THORN_MARK_SIZE', () => {
    expect(sizeOf(thornSheet(ThornTex.marks))).toEqual({ width: THORN_MARK_SIZE, height: THORN_MARK_SIZE });
  });

  it("gives Thornwood's glints keys of their own, since the dark view bakes the colour into the texture", () => {
    const thornKeys = Object.values(THORNWOOD_OBJECTS.glints).map((glint) => glint.key);
    const reefKeys = Object.values(REEF_OBJECTS.glints).map((glint) => glint.key);
    expect(thornKeys.filter((key) => reefKeys.includes(key))).toEqual([]);
  });

  it('gives no two items the same art', () => {
    expect(new Set(Object.values(THORNWOOD_OBJECTS.itemTextures)).size).toBe(POWER_UP_KINDS.length);
    expect(new Set(Object.values(THORNWOOD_OBJECTS.itemIcons).map((ref) => ref.frame)).size).toBe(
      POWER_UP_KINDS.length,
    );
  });

  it('fills most of each 9x9 icon so it reads in the HUD well', () => {
    for (const frame of thornSheet(ThornTex.icons)?.frames ?? []) {
      const drawn = [...frame.rows.join('')].filter((pixel) => pixel !== '.').length;
      expect(drawn, frame.name).toBeGreaterThanOrEqual(30);
    }
  });
});

describe('Thornwood object colours', () => {
  const canopy = [...WOOD_BANDS, ...Object.values(ForestBackdropPalette).flat()];
  const weakest = (colour: number) => Math.min(...canopy.map((band) => contrast(colour, band)));

  it.each(ENEMY_KINDS.map((kind) => [kind, THORNWOOD_OBJECTS.enemies.bodies[kind]] as const))(
    'the %s body colour stands 3:1 off the forest bands',
    (kind) => {
      const palette = { shark: 'boar', eel: 'snake', crab: 'beetle' } as const;
      expect(weakest(ThornEnemyPalette[palette[kind]][1])).toBeGreaterThanOrEqual(3);
    },
  );

  it('keeps the acorn body at least as bright as the pearl and 3:1 off the forest bands', () => {
    const pearlBody = reefSheet(REEF_OBJECTS.pickups.pearl)?.frames[0]?.palette[1] ?? 0;
    expect(luminance(AcornPalette[1] ?? 0)).toBeGreaterThanOrEqual(luminance(pearlBody));
    expect(weakest(AcornPalette[1] ?? 0)).toBeGreaterThanOrEqual(3);
  });
});
