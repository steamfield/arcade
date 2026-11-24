import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { defineTheme } from '../themes/define.ts';
import { OCEAN_THEME } from '../themes/ocean.ts';
import { buildTextures, drawSheets, registerLoops } from './index.ts';
import { sheet } from './sprites/sheet.ts';

/**
 * The parts of a Phaser scene the art builders touch, recording which textures and animations
 * were made. Only Phaser is faked; the builders and themes are the real ones.
 */
function recordingScene() {
  const textures = new Set<string>();
  const anims = new Set<string>();
  const graphics = {
    fillStyle: () => graphics,
    fillRect: () => graphics,
    generateTexture: (key: string) => textures.add(key),
    destroy: () => {},
  };
  const scene = {
    textures: { exists: (key: string) => textures.has(key), get: () => ({ add: () => {} }) },
    make: { graphics: () => graphics },
    anims: { exists: (key: string) => anims.has(key), create: ({ key }: { key: string }) => anims.add(key) },
  } as unknown as Phaser.Scene;
  return { scene, textures, anims };
}

const PIXEL = sheet('tiles', [0xffffff], { a: ['0'], b: ['0'] });

describe('texture and loop ownership', () => {
  it('lets the global art and a theme register twice without change', () => {
    const { scene, textures } = recordingScene();
    buildTextures(scene);
    OCEAN_THEME.registerTextures(scene);
    const built = textures.size;
    buildTextures(scene);
    OCEAN_THEME.registerTextures(scene);
    expect(textures.size).toBe(built);
    expect(textures.has('tiles')).toBe(true);
  });

  it("refuses a second theme that names the ocean's tileset", () => {
    const { scene } = recordingScene();
    OCEAN_THEME.registerTextures(scene);
    const copycat = defineTheme({ ...OCEAN_THEME, registerTextures: (s) => drawSheets(s, [PIXEL], 'copycat') });
    expect(() => copycat.registerTextures(scene)).toThrow("Texture 'tiles' is owned by theme 'ocean'");
  });

  it('refuses a theme texture that reuses a global key, and a loop another theme owns', () => {
    const { scene } = recordingScene();
    buildTextures(scene);
    OCEAN_THEME.registerTextures(scene);
    expect(() => drawSheets(scene, [{ ...PIXEL, key: 'kick-pip' }], 'copycat')).toThrow(
      "Texture 'kick-pip' is owned by the global art",
    );
    expect(() => registerLoops(scene, [{ key: 'kelp-sway', texture: 'tiles', frameRate: 2 }], 'copycat')).toThrow(
      "Animation 'kelp-sway' is owned by theme 'ocean'",
    );
  });
});
