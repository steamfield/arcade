/**
 * Every shipped world's skin names art and words for every character slot, item, enemy and pickup,
 * and a course resolves to its world's skin.
 */
import { describe, expect, it } from 'vitest';
import { COURSES } from '../../logic/courses/index.ts';
import { CHARACTER_IDS } from '../../logic/types.ts';
import { Tex } from '../art/keys.ts';
import { UiTex } from '../art/ui/keys.ts';
import { ForestTex } from '../themes/forest/keys.ts';
import { OceanTex } from '../themes/ocean/keys.ts';
import { SkyItemTex, SkyRacerTex, SkyTex } from './cloudreach/keys.ts';
import { CLOUDREACH_SKIN } from './cloudreach.ts';
import { FARSIDE_SKIN } from './farside.ts';
import { assertSkinAssets, assertSkinTextures, SKINS, skinFor, type TextureLookup } from './index.ts';
import { REEF_SKIN } from './reef.ts';
import { ThornItemTex, ThornRacerTex, ThornTex } from './thornwood/keys.ts';
import type { WorldSkin } from './types.ts';

describe('world skins', () => {
  it.each(Object.values(SKINS))('$id covers every key', (skin) => {
    expect(() => assertSkinAssets(skin)).not.toThrow();
  });

  it('names the world and the missing key when a skin has a gap', () => {
    const { gil: _gil, ...racers } = REEF_SKIN.cast.racers;
    const broken = {
      ...REEF_SKIN,
      id: 'broken',
      cast: { ...REEF_SKIN.cast, racers },
    } as unknown as WorldSkin;
    expect(() => assertSkinAssets(broken)).toThrow("World 'broken' skin has no racer for 'gil'");
  });

  it('names the world and the hazard when a skin has a glint without a key', () => {
    const { glints } = REEF_SKIN.objects;
    const broken = {
      ...REEF_SKIN,
      id: 'broken',
      objects: { ...REEF_SKIN.objects, glints: { ...glints, jelly: { ...glints.jelly, key: '' } } },
    } as WorldSkin;
    expect(() => assertSkinAssets(broken)).toThrow("World 'broken' skin has no glint for 'jelly'");
  });

  it('gives each slot its own racer texture', () => {
    for (const skin of Object.values(SKINS)) {
      const textures = CHARACTER_IDS.map((id) => skin.cast.racers[id]);
      expect(new Set(textures).size).toBe(CHARACTER_IDS.length);
    }
  });

  it('draws Sunlit Shallows with the reef skin', () => {
    expect(skinFor(COURSES['sunlit-shallows'])).toBe(REEF_SKIN);
  });

  it('names the course and world when a course has no skin', () => {
    expect(() => skinFor({ id: 'nowhere', world: 'moon' })).toThrow(
      "Course 'nowhere' names world 'moon', which the engine has no skin for",
    );
  });
});

/** A texture manager that has every texture and frame except those listed. */
function texturesWithout(missing: { texture?: string; frame?: string }): TextureLookup {
  return {
    exists: (key) => key !== missing.texture,
    get: () => ({ has: (frame) => frame !== missing.frame }),
  };
}

describe('the boot texture check', () => {
  it.each(Object.values(SKINS))('$id passes when everything it names was built', (skin) => {
    expect(() => assertSkinTextures(texturesWithout({}), skin)).not.toThrow();
  });

  it('names the world and the texture a skin names but never built', () => {
    const texture = REEF_SKIN.objects.pickups.pearl;
    expect(() => assertSkinTextures(texturesWithout({ texture }), REEF_SKIN)).toThrow(
      `World 'reef' skin names texture '${texture}', which was never built`,
    );
  });

  it('checks the Cloudreach skin too, naming it when a texture it names was never built', () => {
    const texture = CLOUDREACH_SKIN.cast.racers.gil;
    expect(() => assertSkinTextures(texturesWithout({ texture }), CLOUDREACH_SKIN)).toThrow(
      `World 'cloudreach' skin names texture '${texture}', which was never built`,
    );
  });

  it('names the world, the frame and its texture when a frame is missing', () => {
    const { clam } = REEF_SKIN.objects.pickups;
    expect(() => assertSkinTextures(texturesWithout({ frame: 'open' }), REEF_SKIN)).toThrow(
      `World 'reef' skin names frame 'open' of '${clam}', which was never built`,
    );
  });
});

describe('the Cloudreach skin', () => {
  const { text } = CLOUDREACH_SKIN.objects;

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

  it("keeps every ability line and the HUD and How to Play words within the longest of Reef's, so they fit", () => {
    const longest = (strings: readonly string[]) => Math.max(...strings.map((line) => line.length));
    const groups: ((skin: WorldSkin) => string[])[] = [
      (skin) => CHARACTER_IDS.map((id) => skin.cast.abilities[id].name),
      (skin) => CHARACTER_IDS.map((id) => skin.cast.abilities[id].blurb),
      (skin) => [skin.objects.text.slowedBy, skin.objects.text.trapped],
      (skin) => Object.values(skin.objects.text.enemyCaptions),
      (skin) => [skin.objects.text.cratesHeading, skin.objects.text.pearlsHeading],
    ];
    for (const group of groups) {
      expect(longest(group(CLOUDREACH_SKIN))).toBeLessThanOrEqual(longest(group(REEF_SKIN)));
    }
  });

  it("names every Cloudreach texture once under cloudreach-, apart from the global art, the UI kit, the themes', Reef's and Thornwood's", () => {
    const cloudreach: string[] = [
      ...Object.values(SkyRacerTex),
      ...Object.values(SkyTex),
      ...Object.values(SkyItemTex),
    ];
    const others: string[] = [
      ...Object.values(Tex),
      ...Object.values(UiTex),
      ...Object.values(OceanTex),
      ...Object.values(ForestTex),
      ...Object.values(ThornRacerTex),
      ...Object.values(ThornTex),
      ...Object.values(ThornItemTex),
    ];
    expect(cloudreach.filter((key) => !key.startsWith('cloudreach-'))).toEqual([]);
    expect(new Set(cloudreach).size).toBe(cloudreach.length);
    expect(cloudreach.filter((key) => others.includes(key))).toEqual([]);
  });
});

describe('the Farside skin', () => {
  const { text } = FARSIDE_SKIN.objects;

  it("words gil's ability, the items, enemies and pickups the Farside way", () => {
    expect(FARSIDE_SKIN.id).toBe('farside');
    expect(FARSIDE_SKIN.cast.abilities.gil.name).toBe('SPRING BURN');
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

  it("keeps every ability line and the HUD and How to Play words within the longest of Reef's, so they fit", () => {
    const longest = (strings: readonly string[]) => Math.max(...strings.map((line) => line.length));
    const groups: ((skin: WorldSkin) => string[])[] = [
      (skin) => CHARACTER_IDS.map((id) => skin.cast.abilities[id].name),
      (skin) => CHARACTER_IDS.map((id) => skin.cast.abilities[id].blurb),
      (skin) => [skin.objects.text.slowedBy, skin.objects.text.trapped],
      (skin) => Object.values(skin.objects.text.enemyCaptions),
      (skin) => [skin.objects.text.cratesHeading, skin.objects.text.pearlsHeading],
    ];
    for (const group of groups) {
      expect(longest(group(FARSIDE_SKIN))).toBeLessThanOrEqual(longest(group(REEF_SKIN)));
    }
    expect(longest(Object.values(text.attackCaptions))).toBeLessThanOrEqual(11);
  });
});
