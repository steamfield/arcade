/**
 * Reef's art is drawn by its own skin: the global art and the UI kit build none of it (apart from
 * the HUD item icons in the UI kit's shared `ui-icons`), and after `REEF_SKIN.registerTextures`
 * the boot texture check passes for Reef.
 */
import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS, ENEMY_KINDS, POWER_UP_KINDS } from '../../../logic/types.ts';
import { buildTextures } from '../../art/index.ts';
import { buildUiTextures } from '../../art/ui/index.ts';
import { UiTex } from '../../art/ui/keys.ts';
import { assertSkinTextures } from '../index.ts';
import { REEF_SKIN } from '../reef.ts';

/**
 * The parts of a Phaser scene the art builders touch, recording the frames of each texture made.
 * Only Phaser is faked; the builders and the skin are the real ones.
 */
function recordingScene() {
  const built = new Map<string, string[]>();
  const fonts = new Set<string>();
  const graphics = {
    fillStyle: () => graphics,
    fillRect: () => graphics,
    generateTexture: (key: string) => built.set(key, []),
    destroy: () => {},
  };
  const textures = {
    exists: (key: string) => built.has(key),
    get: (key: string) => ({
      add: (frame: string) => built.get(key)?.push(frame),
      has: (frame: string) => built.get(key)?.includes(frame) ?? false,
    }),
  };
  const scene = {
    textures,
    make: { graphics: () => graphics },
    cache: { bitmapFont: { exists: (key: string) => fonts.has(key), add: (key: string) => fonts.add(key) } },
  } as unknown as Phaser.Scene;
  return { scene, textures, built };
}

/** Every texture Reef's skin names. */
function reefTextures(): string[] {
  const { cast, objects } = REEF_SKIN;
  return [
    ...CHARACTER_IDS.flatMap((id) => [cast.racers[id], cast.portraits[id].texture, cast.heads[id].texture]),
    ...POWER_UP_KINDS.flatMap((kind) => [objects.itemIcons[kind].texture, objects.itemTextures[kind]]),
    ...Object.values(objects.attack),
    objects.pickups.pearl,
    objects.pickups.clam,
    ...ENEMY_KINDS.map((kind) => objects.enemies.bodies[kind]),
    objects.enemies.eelBody,
    objects.enemies.marks,
  ];
}

describe('Reef skin textures', () => {
  it('are not built by the global art or the UI kit, except the shared HUD icons', () => {
    const { scene, built } = recordingScene();
    buildTextures(scene);
    buildUiTextures(scene);
    const prebuilt = new Set(reefTextures().filter((key) => built.has(key)));
    expect([...prebuilt]).toEqual([UiTex.icons]);
  });

  it('pass the boot texture check once the skin registers its own, after the global art and UI kit', () => {
    const { scene, textures } = recordingScene();
    buildTextures(scene);
    buildUiTextures(scene);
    REEF_SKIN.registerTextures(scene);
    expect(() => assertSkinTextures(textures, REEF_SKIN)).not.toThrow();
  });

  it('fail the boot texture check without the skin registering, naming the first missing texture', () => {
    const { scene, textures } = recordingScene();
    buildTextures(scene);
    buildUiTextures(scene);
    expect(() => assertSkinTextures(textures, REEF_SKIN)).toThrow(
      `World 'reef' skin names texture '${REEF_SKIN.cast.racers.rudy}', which was never built`,
    );
  });

  it('can be registered again without redrawing', () => {
    const { scene, built } = recordingScene();
    REEF_SKIN.registerTextures(scene);
    const first = new Map([...built].map(([key, frames]) => [key, [...frames]]));
    REEF_SKIN.registerTextures(scene);
    expect(built).toEqual(first);
  });
});
