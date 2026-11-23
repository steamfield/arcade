/**
 * What a world skin is: everything the engine draws or words differently per world, keyed by the
 * world's id. A world's cast and object art are split so each can be built on its own.
 */
import type Phaser from 'phaser';
import type { CastSkin } from './cast-skin.ts';
import type { ObjectSkin } from './object-skin.ts';

/** A world as the engine draws it. */
export interface WorldSkin {
  /** The logic world's id (`WorldDef.id`). */
  id: string;
  cast: CastSkin;
  objects: ObjectSkin;
  /** Builds the world's own textures at boot. Reef's art is the global art `art/index.ts` builds, so its is empty. */
  registerTextures(scene: Phaser.Scene): void;
}
