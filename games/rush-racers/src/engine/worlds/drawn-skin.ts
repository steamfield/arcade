/**
 * What the skin conformance suite works from: a world's expected look, as a fixture, and the
 * textures the skin draws on a recording scene after the global art, the UI kit and the themes.
 */
import type Phaser from 'phaser';
import type { CharacterId, EnemyKind } from '../../logic/types.ts';
import { buildTextures } from '../art/index.ts';
import type { Palette } from '../art/pixel.ts';
import { buildUiTextures } from '../art/ui/index.ts';
import { registerArt as registerForestArt } from '../themes/forest/art.ts';
import { registerArt as registerOceanArt } from '../themes/ocean/art.ts';
import { registerArt as registerSkyArt } from '../themes/sky/art.ts';
import { registerArt as registerSpaceArt } from '../themes/space/art.ts';
import { type RecordingScene, recordingScene } from './recording-scene.ts';
import { REEF_ITEM_ICON_FRAMES } from './reef/sprites/icons.ts';
import type { WorldSkin } from './types.ts';

/** Every theme's `registerArt`, in the order the game registers them. */
const THEME_ART = [registerOceanArt, registerForestArt, registerSpaceArt, registerSkyArt];

/** What a world's art must look like, beyond what every skin has to satisfy. */
export interface SkinFixture {
  skin: WorldSkin;
  /** The world's `registerArt` from its `art.ts`, which draws every texture the skin names. */
  registerArt: (scene: Phaser.Scene) => void;
  /** The four colours of each slot's racer, portrait and head. */
  castPalettes: Readonly<Record<CharacterId, Palette>>;
  /** The prefix every texture key the skin draws starts with; Reef's keys are unprefixed. */
  keyPrefix?: string;
  /** The world's backdrop and the body colours that must stand out from it; absent where the world has no such rule. */
  contrast?: {
    /** Band and backdrop colours of the world's theme. */
    backdrop: readonly number[];
    /** Palette index 1 of each enemy kind's art. */
    enemyBodies: Readonly<Record<EnemyKind, number>>;
    /** Palette index 1 of the pickup that stands in for the pearl. */
    pickupBody: number;
  };
}

/** A skin drawn on a recording scene. */
export interface DrawnSkin {
  skin: WorldSkin;
  art: RecordingScene;
  /** Texture keys the world's `registerArt` drew. */
  skinKeys: ReadonlySet<string>;
}

/**
 * Returns a function that draws the shared art, then the world's own textures, on a fresh recording
 * scene the first time it is called and returns that same drawing after. Calling it inside a test
 * means a malformed sprite or a key another owner holds fails that world's tests, not the file.
 * Reusing a key the shared art or a theme drew throws in `drawFrames` and `claim`, so no separate
 * collision check is needed.
 */
export function lazyDrawnSkin({ skin, registerArt }: Pick<SkinFixture, 'skin' | 'registerArt'>): () => DrawnSkin {
  let drawn: DrawnSkin | undefined;
  return () => {
    if (drawn) return drawn;
    const art = recordingScene();
    buildTextures(art.scene);
    buildUiTextures(art.scene, REEF_ITEM_ICON_FRAMES);
    for (const registerArt of THEME_ART) registerArt(art.scene);
    const baseKeys = new Set(art.built.keys());
    registerArt(art.scene);
    const skinKeys = new Set([...art.built.keys()].filter((key) => !baseKeys.has(key)));
    drawn = { skin, art, skinKeys };
    return drawn;
  };
}
