/**
 * Farside's own object rows: its words for items, enemies and pickups, and object art that is its
 * own drawing, not Thornwood's. What every world's object art shares is checked in
 * `worlds/skins.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS } from '../../../logic/types.ts';
import type { ArtSheet } from '../../art/sprites/sheet.ts';
import { FARSIDE_SKIN } from '../farside.ts';
import { ATTACK_ART_SHEETS as THORNWOOD_ATTACK_SHEETS } from '../thornwood/sprites/attack.ts';
import { THORN_ENEMY_SHEETS } from '../thornwood/sprites/enemies.ts';
import { ITEM_ART_SHEETS as THORNWOOD_ITEM_SHEETS } from '../thornwood/sprites/items.ts';
import { THORN_MARK_SHEET } from '../thornwood/sprites/marks.ts';
import { THORN_PICKUP_SHEETS } from '../thornwood/sprites/pickups.ts';
import { ATTACK_ART_SHEETS } from './sprites/attack.ts';
import { FAR_ENEMY_SHEETS } from './sprites/enemies.ts';
import { ITEM_ART_SHEETS } from './sprites/items.ts';
import { FAR_MARK_SHEET } from './sprites/marks.ts';
import { FAR_PICKUP_SHEETS } from './sprites/pickups.ts';

/** The longest an attack caption may be, so it fits under the item box. */
const MAX_ATTACK_CAPTION = 11;

const { text } = FARSIDE_SKIN.objects;

describe('Farside object words', () => {
  it('words the items, enemies and pickups the Farside way', () => {
    expect(text.attackCaptions).toEqual({
      homingSquid: 'PROBE',
      riptide: 'ION STREAM',
      undertow: 'TRACTOR',
      mimic: 'HOLOGRAM',
    });
    expect(text.enemyCaptions).toEqual({ crab: 'MITE WALKS', shark: 'RAY CHARGES', eel: 'WORM LUNGES' });
    expect([text.cratesHeading, text.pearlsHeading, text.slowedBy, text.trapped]).toEqual([
      'SUPPLY PODS',
      'STARDUST',
      'SLOWED BY GAS',
      'FIELD',
    ]);
  });

  it("uses none of the Reef's or Cloudreach's words in its abilities or object text", () => {
    const abilities = CHARACTER_IDS.flatMap((id) => [
      FARSIDE_SKIN.cast.abilities[id].name,
      FARSIDE_SKIN.cast.abilities[id].blurb,
    ]);
    const words = [
      ...abilities,
      text.slowedBy,
      text.trapped,
      text.cratesHeading,
      text.pearlsHeading,
      ...Object.values(text.attackCaptions),
      ...Object.values(text.enemyCaptions),
    ];

    expect(
      words.filter((line) =>
        /\b(CORAL|SQUID|CLAMS?|PEARLS?|INK|SHARK|EEL|CRAB|KICKS?|BUBBLE|SWIM|FLAPS?|PUFFS?|STORMS?|ZAPS?)\b/.test(line),
      ),
    ).toEqual([]);
  });

  it(`keeps every attack caption within ${MAX_ATTACK_CAPTION} letters`, () => {
    const longest = Math.max(...Object.values(text.attackCaptions).map((caption) => caption.length));
    expect(longest).toBeLessThanOrEqual(MAX_ATTACK_CAPTION);
  });
});

describe('Farside object art', () => {
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
    const farside = drawn([
      ...ITEM_ART_SHEETS,
      ...ATTACK_ART_SHEETS,
      ...FAR_PICKUP_SHEETS,
      ...FAR_ENEMY_SHEETS,
      FAR_MARK_SHEET,
    ]);

    expect(farside.filter((rows) => thornwood.has(rows))).toHaveLength(0);
  });
});
