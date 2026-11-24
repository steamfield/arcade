/**
 * Cloudreach's own object rows: its words for items, enemies and pickups, and the balloon's two
 * states. What every world's object art shares is checked in `worlds/skins.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS } from '../../../logic/types.ts';
import { Frame } from '../../art/keys.ts';
import { CLOUDREACH_SKIN } from '../cloudreach.ts';
import { SkyTex } from './keys.ts';
import { SKY_PICKUP_SHEETS } from './sprites/pickups.ts';

const { text } = CLOUDREACH_SKIN.objects;

const drawnPixels = (rows: readonly string[]) => [...rows.join('')].filter((pixel) => pixel !== '.').length;

describe('Cloudreach object words', () => {
  it("words gil's ability, the items, enemies and pickups the Cloudreach way", () => {
    expect(CLOUDREACH_SKIN.cast.abilities.gil.name).toBe('SPRING FLAP');
    expect(text.attackCaptions).toEqual({
      homingSquid: 'HOMING GULL',
      riptide: 'JET STREAM',
      undertow: 'HEADWIND',
      mimic: 'MIRAGE',
    });
    expect(text.enemyCaptions).toEqual({
      crab: expect.stringContaining('CLOUD CRAB'),
      shark: 'CROW DIVES',
      eel: 'EEL LUNGES',
    });
    expect([text.cratesHeading, text.pearlsHeading, text.slowedBy, text.trapped]).toEqual([
      'BALLOON POP',
      'FEATHERS',
      'SLOWED BY FOG',
      'CLOUD',
    ]);
  });

  it("uses none of the Reef's words in its abilities or object text", () => {
    const abilities = CHARACTER_IDS.flatMap((id) => [
      CLOUDREACH_SKIN.cast.abilities[id].name,
      CLOUDREACH_SKIN.cast.abilities[id].blurb,
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

    expect(words.filter((line) => /\b(CORAL|SQUID|CLAMS?|PEARLS?|INK|SHARK|KICKS?|BUBBLE|SWIM)\b/.test(line))).toEqual(
      [],
    );
  });
});

describe('Cloudreach object art', () => {
  it('shows a full balloon while it is ready and only a popped scrap once used', () => {
    const balloon = SKY_PICKUP_SHEETS.find((sheet) => sheet.key === SkyTex.balloon)?.frames ?? [];
    const ready = balloon.find((frame) => frame.name === Frame.clamOpen)?.rows ?? [];
    const used = balloon.find((frame) => frame.name === Frame.clamClosed)?.rows ?? [];
    expect(drawnPixels(ready)).toBeGreaterThan(2 * drawnPixels(used));
  });
});
