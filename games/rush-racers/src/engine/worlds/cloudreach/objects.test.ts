/**
 * Cloudreach's object art: every object key `keys.ts` names is built with the frames the views ask
 * for, at Reef's sizes, the icons fill their 9x9 well, and the enemies and the feather stand out from
 * the sky's bands.
 */
import { describe, expect, it } from 'vitest';
import { ENEMY_KINDS, POWER_UP_KINDS } from '../../../logic/types.ts';
import { Frame } from '../../art/keys.ts';
import { measureFrames } from '../../art/pixel.ts';
import type { ArtSheet } from '../../art/sprites/sheet.ts';
import { iconSheets } from '../../art/ui/icons.ts';
import { UiTex } from '../../art/ui/keys.ts';
import { SKY_BANDS, SkyBackdropPalette } from '../../themes/sky/palettes.ts';
import { REEF_OBJECT_SHEETS, REEF_OBJECTS } from '../reef/objects.ts';
import { REEF_ITEM_ICON_FRAMES } from '../reef/sprites/icons.ts';
import { THORNWOOD_OBJECTS } from '../thornwood/objects.ts';
import { SkyIconFrame, SkyItemTex, SkyTex } from './keys.ts';
import { CLOUDREACH_OBJECTS } from './objects.ts';
import { SKY_ATTACK_SHEETS } from './sprites/attack.ts';
import { SKY_ENEMY_SHEETS, SkyEnemyPalette } from './sprites/enemies.ts';
import { SKY_ITEM_SHEETS } from './sprites/items.ts';
import { SKY_MARK_SHEET, SKY_MARK_SIZE } from './sprites/marks.ts';
import { FeatherPalette, SKY_PICKUP_SHEETS } from './sprites/pickups.ts';

const SKY_SHEETS: readonly ArtSheet<string>[] = [
  ...SKY_ITEM_SHEETS,
  ...SKY_ATTACK_SHEETS,
  ...SKY_PICKUP_SHEETS,
  ...SKY_ENEMY_SHEETS,
  SKY_MARK_SHEET,
];

/** The fewest drawn pixels a 9x9 icon may have and still read as a shape in the HUD well. */
const MIN_ICON_PIXELS = 30;

const skySheet = (key: string) => SKY_SHEETS.find((sheet) => sheet.key === key);
const reefSheet = (key: string) => REEF_OBJECT_SHEETS.find((sheet) => sheet.key === key);
const sizeOf = (sheet: ArtSheet<string> | undefined) => measureFrames(sheet?.key ?? 'missing', sheet?.frames ?? []);
const frameNames = (sheet: ArtSheet<string> | undefined) => sheet?.frames.map((frame) => frame.name);
const drawnPixels = (rows: readonly string[]) => [...rows.join('')].filter((pixel) => pixel !== '.').length;

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

describe('Cloudreach object art', () => {
  it('draws every object texture keys.ts names, once', () => {
    const wanted = [
      ...Object.values(SkyItemTex),
      ...Object.entries(SkyTex)
        .filter(([name]) => name !== 'portraits' && name !== 'heads')
        .map(([, key]) => key),
    ];
    expect(SKY_SHEETS.map((sheet) => sheet.key).sort()).toEqual(wanted.sort());
  });

  it.each(SKY_SHEETS.map((sheet) => [sheet.key, sheet] as const))('%s is well-formed pixel text', (key, sheet) => {
    expect(() => measureFrames(key, sheet.frames)).not.toThrow();
    for (const frame of sheet.frames) expect(frame.palette.length).toBeLessThanOrEqual(4);
  });

  it('gives the icon sheet one 9x9 frame per item, named as keys.ts says', () => {
    const icons = skySheet(SkyTex.icons);
    expect(frameNames(icons)?.sort()).toEqual(POWER_UP_KINDS.map((kind) => SkyIconFrame[kind]).sort());
    const reefIcons = iconSheets(REEF_ITEM_ICON_FRAMES).find((sheet) => sheet.key === UiTex.icons);
    expect(sizeOf(icons)).toEqual(measureFrames('reef icons', reefIcons?.frames ?? []));
  });

  const { itemTextures, attack, pickups, enemies } = CLOUDREACH_OBJECTS;
  /** Every Cloudreach texture paired with the Reef texture in the same slot. */
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

  it.each(counterparts)("sizes %s like its Reef counterpart's %s", (sky, reefKey) => {
    expect(sizeOf(skySheet(sky))).toEqual(sizeOf(reefSheet(reefKey)));
  });

  it.each(counterparts)(
    'gives %s the frames its Reef counterpart %s has, since views ask for them by name',
    (sky, reefKey) => {
      expect(frameNames(skySheet(sky))).toEqual(frameNames(reefSheet(reefKey)));
    },
  );

  it('draws the marks on frames of SKY_MARK_SIZE', () => {
    expect(sizeOf(skySheet(SkyTex.marks))).toEqual({ width: SKY_MARK_SIZE, height: SKY_MARK_SIZE });
  });

  it("gives Cloudreach's glints keys of their own, since the dark view bakes the colour into the texture", () => {
    const skyKeys = Object.values(CLOUDREACH_OBJECTS.glints).map((glint) => glint.key);
    const otherKeys = [...Object.values(REEF_OBJECTS.glints), ...Object.values(THORNWOOD_OBJECTS.glints)].map(
      (glint) => glint.key,
    );
    expect(skyKeys.filter((key) => otherKeys.includes(key))).toEqual([]);
    expect(new Set(skyKeys).size).toBe(skyKeys.length);
  });

  it('gives no two items the same art', () => {
    expect(new Set(Object.values(CLOUDREACH_OBJECTS.itemTextures)).size).toBe(POWER_UP_KINDS.length);
    expect(new Set(Object.values(CLOUDREACH_OBJECTS.itemIcons).map((ref) => ref.frame)).size).toBe(
      POWER_UP_KINDS.length,
    );
    const iconRows = skySheet(SkyTex.icons)?.frames.map((frame) => frame.rows.join('|')) ?? [];
    expect(new Set(iconRows).size).toBe(POWER_UP_KINDS.length);
  });

  it('fills most of each 9x9 icon so it reads in the HUD well', () => {
    for (const frame of skySheet(SkyTex.icons)?.frames ?? []) {
      expect(drawnPixels(frame.rows), frame.name).toBeGreaterThanOrEqual(MIN_ICON_PIXELS);
    }
  });

  it('shows a full balloon while it is ready and only a popped scrap once used', () => {
    const balloon = skySheet(SkyTex.balloon)?.frames ?? [];
    const ready = balloon.find((frame) => frame.name === Frame.clamOpen)?.rows ?? [];
    const used = balloon.find((frame) => frame.name === Frame.clamClosed)?.rows ?? [];
    expect(drawnPixels(ready)).toBeGreaterThan(2 * drawnPixels(used));
  });
});

describe('Cloudreach object colours', () => {
  const sky = [...SKY_BANDS, ...Object.values(SkyBackdropPalette).flat()];
  const weakest = (colour: number) => Math.min(...sky.map((band) => contrast(colour, band)));
  const paletteOf = { shark: 'stormCrow', eel: 'skyEel', crab: 'cloudCrab' } as const;

  it.each(ENEMY_KINDS.map((kind) => [kind, paletteOf[kind]] as const))(
    'the %s (%s) body colour stands 3:1 off the sky bands',
    (_kind, palette) => {
      expect(weakest(SkyEnemyPalette[palette][1])).toBeGreaterThanOrEqual(3);
    },
  );

  it('keeps the feather body at least as bright as the pearl and 3:1 off the sky bands', () => {
    const pearlBody = reefSheet(REEF_OBJECTS.pickups.pearl)?.frames[0]?.palette[1] ?? 0;
    expect(luminance(FeatherPalette[1] ?? 0)).toBeGreaterThanOrEqual(luminance(pearlBody));
    expect(weakest(FeatherPalette[1] ?? 0)).toBeGreaterThanOrEqual(3);
  });
});
