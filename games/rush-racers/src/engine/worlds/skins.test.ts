/**
 * Every shipped world's skin names art and words for every character slot, item, enemy and pickup,
 * a course resolves to its world's skin, and each world's art passes the shared conformance suite.
 */
import { describe, expect, it } from 'vitest';
import { COURSES } from '../../logic/courses/index.ts';
import { CHARACTER_IDS } from '../../logic/types.ts';
import { ForestBackdropPalette, WOOD_BANDS } from '../themes/forest/palettes.ts';
import { BackdropPalette, WATER_BANDS } from '../themes/ocean/palettes.ts';
import { SKY_BANDS, SkyBackdropPalette } from '../themes/sky/palettes.ts';
import { SpaceBackdropPalette, VOID_BANDS } from '../themes/space/palettes.ts';
import { registerArt as registerCloudreachArt } from './cloudreach/art.ts';
import { SkyEnemyPalette } from './cloudreach/sprites/enemies.ts';
import { CloudreachPalette } from './cloudreach/sprites/palette.ts';
import { FeatherPalette } from './cloudreach/sprites/pickups.ts';
import { CLOUDREACH_SKIN } from './cloudreach.ts';
import type { SkinFixture } from './drawn-skin.ts';
import { registerArt as registerFarsideArt } from './farside/art.ts';
import { FarEnemyPalette } from './farside/sprites/enemies.ts';
import { FarsidePalette } from './farside/sprites/palette.ts';
import { StardustPalette } from './farside/sprites/pickups.ts';
import { FARSIDE_SKIN } from './farside.ts';
import { assertSkinAssets, assertSkinTextures, SKINS, skinFor, type TextureLookup } from './index.ts';
import { registerArt as registerReefArt } from './reef/art.ts';
import { ReefEnemyPalette } from './reef/sprites/enemies.ts';
import { ReefPalette } from './reef/sprites/palette.ts';
import { PearlPalette } from './reef/sprites/pickups.ts';
import { REEF_SKIN } from './reef.ts';
import { describeSkinConformance } from './skin-conformance.ts';
import { registerArt as registerThornwoodArt } from './thornwood/art.ts';
import { ThornEnemyPalette } from './thornwood/sprites/enemies.ts';
import { ThornwoodPalette } from './thornwood/sprites/palette.ts';
import { AcornPalette } from './thornwood/sprites/pickups.ts';
import { THORNWOOD_SKIN } from './thornwood.ts';
import type { WorldSkin } from './types.ts';

/** What each world's art is held to beyond the checks every skin passes. */
const FIXTURES: readonly SkinFixture[] = [
  {
    skin: REEF_SKIN,
    registerArt: registerReefArt,
    castPalettes: ReefPalette,
    contrast: {
      backdrop: [...WATER_BANDS, ...Object.values(BackdropPalette).flat()],
      enemyBodies: { shark: ReefEnemyPalette.shark[1], eel: ReefEnemyPalette.eel[1], crab: ReefEnemyPalette.crab[1] },
      pickupBody: PearlPalette[1] ?? 0,
    },
  },
  {
    skin: THORNWOOD_SKIN,
    registerArt: registerThornwoodArt,
    castPalettes: ThornwoodPalette,
    keyPrefix: 'thornwood-',
    contrast: {
      backdrop: [...WOOD_BANDS, ...Object.values(ForestBackdropPalette).flat()],
      enemyBodies: {
        shark: ThornEnemyPalette.boar[1],
        eel: ThornEnemyPalette.snake[1],
        crab: ThornEnemyPalette.beetle[1],
      },
      pickupBody: AcornPalette[1] ?? 0,
    },
  },
  {
    skin: CLOUDREACH_SKIN,
    registerArt: registerCloudreachArt,
    castPalettes: CloudreachPalette,
    keyPrefix: 'cloudreach-',
    contrast: {
      backdrop: [...SKY_BANDS, ...Object.values(SkyBackdropPalette).flat()],
      enemyBodies: {
        shark: SkyEnemyPalette.stormCrow[1],
        eel: SkyEnemyPalette.skyEel[1],
        crab: SkyEnemyPalette.cloudCrab[1],
      },
      pickupBody: FeatherPalette[1] ?? 0,
    },
  },
  {
    skin: FARSIDE_SKIN,
    registerArt: registerFarsideArt,
    castPalettes: FarsidePalette,
    keyPrefix: 'farside-',
    contrast: {
      backdrop: [...VOID_BANDS, ...Object.values(SpaceBackdropPalette).flat()],
      enemyBodies: { shark: FarEnemyPalette.ray[1], eel: FarEnemyPalette.worm[1], crab: FarEnemyPalette.mite[1] },
      pickupBody: StardustPalette[1] ?? 0,
    },
  },
];

describeSkinConformance(FIXTURES);

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
