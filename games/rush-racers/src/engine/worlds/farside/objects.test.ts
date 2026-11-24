/**
 * Farside's object art: every key `keys.ts` names is built with the frames the views ask for, at
 * Reef's sizes, and the enemies and the stardust stand out from the space bands and backdrop.
 */
import { describe, expect, it } from 'vitest';
import { ENEMY_KINDS, POWER_UP_KINDS } from '../../../logic/types.ts';
import { measureFrames } from '../../art/pixel.ts';
import type { ArtSheet } from '../../art/sprites/sheet.ts';
import { ICON_SHEETS } from '../../art/ui/icons.ts';
import { UiTex } from '../../art/ui/keys.ts';
import { SpaceBackdropPalette, VOID_BANDS } from '../../themes/space/palettes.ts';
import { REEF_OBJECT_SHEETS, REEF_OBJECTS } from '../reef/objects.ts';
import { ATTACK_ART_SHEETS as THORNWOOD_ATTACK_SHEETS } from '../thornwood/sprites/attack.ts';
import { THORN_ENEMY_SHEETS } from '../thornwood/sprites/enemies.ts';
import { ITEM_ART_SHEETS as THORNWOOD_ITEM_SHEETS } from '../thornwood/sprites/items.ts';
import { THORN_MARK_SHEET } from '../thornwood/sprites/marks.ts';
import { THORN_PICKUP_SHEETS } from '../thornwood/sprites/pickups.ts';
import { FarIconFrame, FarItemTex, FarTex } from './keys.ts';
import { FARSIDE_OBJECTS } from './objects.ts';
import { ATTACK_ART_SHEETS } from './sprites/attack.ts';
import { FAR_ENEMY_SHEETS, FarEnemyPalette } from './sprites/enemies.ts';
import { ITEM_ART_SHEETS } from './sprites/items.ts';
import { FAR_MARK_SHEET, FAR_MARK_SIZE } from './sprites/marks.ts';
import { FAR_PICKUP_SHEETS, StardustPalette } from './sprites/pickups.ts';

const FAR_SHEETS: readonly ArtSheet<string>[] = [
  ...ITEM_ART_SHEETS,
  ...ATTACK_ART_SHEETS,
  ...FAR_PICKUP_SHEETS,
  ...FAR_ENEMY_SHEETS,
  FAR_MARK_SHEET,
];

const farSheet = (key: string) => FAR_SHEETS.find((sheet) => sheet.key === key);
const reefSheet = (key: string) => REEF_OBJECT_SHEETS.find((sheet) => sheet.key === key);
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

describe('Farside object art', () => {
  it('draws every object texture key.ts names, once', () => {
    const wanted = [
      ...Object.values(FarItemTex),
      ...Object.entries(FarTex)
        .filter(([name]) => name !== 'portraits' && name !== 'heads')
        .map(([, key]) => key),
    ];
    expect(FAR_SHEETS.map((sheet) => sheet.key).sort()).toEqual(wanted.sort());
  });

  it.each(FAR_SHEETS.map((sheet) => [sheet.key, sheet] as const))('%s is well-formed pixel text', (key, sheet) => {
    expect(() => measureFrames(key, sheet.frames)).not.toThrow();
    for (const frame of sheet.frames) expect(frame.palette.length).toBeLessThanOrEqual(4);
  });

  it('gives the icon sheet one 9x9 frame per item, named as keys.ts says', () => {
    const icons = farSheet(FarTex.icons);
    expect(frameNames(icons)?.sort()).toEqual(POWER_UP_KINDS.map((kind) => FarIconFrame[kind]).sort());
    const reefIcons = ICON_SHEETS.find((sheet) => sheet.key === UiTex.icons);
    expect(sizeOf(icons)).toEqual(measureFrames('reef icons', reefIcons?.frames ?? []));
  });

  const { itemTextures, attack, pickups, enemies } = FARSIDE_OBJECTS;
  /** Every Farside texture paired with the Reef texture in the same slot. */
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

  it.each(counterparts)("sizes %s like its Reef counterpart's %s", (farKey, reefKey) => {
    expect(sizeOf(farSheet(farKey))).toEqual(sizeOf(reefSheet(reefKey)));
  });

  it.each(counterparts)(
    'gives %s the frames its Reef counterpart %s has, since views ask for them by name',
    (farKey, reefKey) => {
      expect(frameNames(farSheet(farKey))).toEqual(frameNames(reefSheet(reefKey)));
    },
  );

  it('draws the marks on frames of FAR_MARK_SIZE', () => {
    expect(sizeOf(farSheet(FarTex.marks))).toEqual({ width: FAR_MARK_SIZE, height: FAR_MARK_SIZE });
  });

  it("gives Farside's glints keys of their own, since the dark view bakes the colour into the texture", () => {
    const farKeys = Object.values(FARSIDE_OBJECTS.glints).map((glint) => glint.key);
    const reefKeys = Object.values(REEF_OBJECTS.glints).map((glint) => glint.key);
    expect(farKeys.filter((key) => reefKeys.includes(key))).toEqual([]);
  });

  it('gives no two items the same art', () => {
    expect(new Set(Object.values(FARSIDE_OBJECTS.itemTextures)).size).toBe(POWER_UP_KINDS.length);
    expect(new Set(Object.values(FARSIDE_OBJECTS.itemIcons).map((ref) => ref.frame)).size).toBe(POWER_UP_KINDS.length);
  });

  it('fills most of each 9x9 icon so it reads in the HUD well', () => {
    for (const frame of farSheet(FarTex.icons)?.frames ?? []) {
      const drawn = [...frame.rows.join('')].filter((pixel) => pixel !== '.').length;
      expect(drawn, frame.name).toBeGreaterThanOrEqual(30);
    }
  });
});

describe("Farside's own object art", () => {
  it("draws no item, attack, pickup, enemy or mark frame that is one of Thornwood's", () => {
    const drawn = (sheets: readonly ArtSheet<string>[]) =>
      sheets.flatMap((sheet) => sheet.frames.map((frame) => frame.rows.join('\n')));
    const thornwood = new Set(
      drawn([
        ...THORNWOOD_ITEM_SHEETS,
        ...THORNWOOD_ATTACK_SHEETS,
        ...THORN_PICKUP_SHEETS,
        ...THORN_ENEMY_SHEETS,
        THORN_MARK_SHEET,
      ]),
    );

    expect(drawn(FAR_SHEETS).filter((rows) => thornwood.has(rows))).toHaveLength(0);
  });
});

describe('Farside object colours', () => {
  const bands = [...VOID_BANDS, ...Object.values(SpaceBackdropPalette).flat()];
  const weakest = (colour: number) => Math.min(...bands.map((band) => contrast(colour, band)));

  it.each(ENEMY_KINDS.map((kind) => [kind, FARSIDE_OBJECTS.enemies.bodies[kind]] as const))(
    'the %s body colour stands 3:1 off the space bands',
    (kind) => {
      const palette = { shark: 'ray', eel: 'worm', crab: 'mite' } as const;
      expect(weakest(FarEnemyPalette[palette[kind]][1])).toBeGreaterThanOrEqual(3);
    },
  );

  it('keeps the stardust body at least as bright as the pearl and 3:1 off the space bands', () => {
    const pearlBody = reefSheet(REEF_OBJECTS.pickups.pearl)?.frames[0]?.palette[1] ?? 0;
    expect(luminance(StardustPalette[1] ?? 0)).toBeGreaterThanOrEqual(luminance(pearlBody));
    expect(weakest(StardustPalette[1] ?? 0)).toBeGreaterThanOrEqual(3);
  });
});
