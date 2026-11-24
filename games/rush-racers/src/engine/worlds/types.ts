/**
 * What a world skin is: everything the engine draws or words differently per world, keyed by the
 * world's id. A world's cast and object art are split so each can be built on its own.
 */
import type Phaser from 'phaser';
import type { CastSkin } from './cast-skin.ts';
import type { ObjectSkin } from './object-skin.ts';

/** How a hazard looks: a texture with a still frame, or a looping animation. */
export interface HazardSkin {
  texture: string;
  /** The frame shown when `anim` is null. */
  frame: string;
  /** A looping animation the sprite plays; null for a still image. */
  anim: string | null;
}

/** The art a world draws in the two hazard slots: urchins and jellies, whatever the world calls them. */
export interface HazardSkins {
  urchin: HazardSkin;
  jelly: HazardSkin;
}

/** A world's object skin with the art for its hazards. */
export interface WorldObjects extends ObjectSkin {
  hazards: HazardSkins;
}

/** A world as the engine draws it. */
export interface WorldSkin {
  /** The logic world's id (`WorldDef.id`). */
  id: string;
  cast: CastSkin;
  objects: WorldObjects;
  /** Builds the world's own cast, object and hazard textures at boot; calling it again changes nothing. */
  registerTextures(scene: Phaser.Scene): void;
}
