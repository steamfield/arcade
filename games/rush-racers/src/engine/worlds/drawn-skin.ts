/**
 * What the skin conformance suite works from: a world's expected look, as a fixture, and the
 * textures the skin draws on a recording scene after the global art, the UI kit and the themes.
 */
import type { CharacterId, EnemyKind } from '../../logic/types.ts';
import { buildTextures } from '../art/index.ts';
import type { Palette } from '../art/pixel.ts';
import { buildUiTextures } from '../art/ui/index.ts';
import { registerThemeTextures } from '../themes/index.ts';
import { type RecordingScene, recordingScene } from './recording-scene.ts';
import { REEF_ITEM_ICON_FRAMES } from './reef/sprites/icons.ts';
import type { WorldSkin } from './types.ts';

/** What a world's art must look like, beyond what every skin has to satisfy. */
export interface SkinFixture {
  skin: WorldSkin;
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
  /** Texture keys that existed before the skin registered: the global art, the UI kit and the themes. */
  baseKeys: ReadonlySet<string>;
  /** Texture keys the skin's own `registerTextures` drew. */
  skinKeys: ReadonlySet<string>;
}

/** Draws the shared art, then `skin`'s own textures, on a fresh recording scene. */
export function drawSkin(skin: WorldSkin): DrawnSkin {
  const art = recordingScene();
  buildTextures(art.scene);
  buildUiTextures(art.scene, REEF_ITEM_ICON_FRAMES);
  registerThemeTextures(art.scene);
  const baseKeys = new Set(art.built.keys());
  skin.registerTextures(art.scene);
  const skinKeys = new Set([...art.built.keys()].filter((key) => !baseKeys.has(key)));
  return { skin, art, baseKeys, skinKeys };
}
