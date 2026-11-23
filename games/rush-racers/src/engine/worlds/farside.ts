/**
 * Farside's world skin. Until Farside has its own art it draws with Reef's racer and object
 * textures, so only the words here are Farside's. Each string stays within the longest Reef string
 * of the same kind, which is what the select card, HUD and How to Play lay out for, except the
 * attack captions, which the attacks page fits up to 11 characters.
 */
import type { CastSkin } from './cast-skin.ts';
import type { ObjectSkin } from './object-skin.ts';
import { REEF_CAST } from './reef/cast.ts';
import { REEF_OBJECTS } from './reef/objects.ts';
import type { WorldSkin } from './types.ts';

/** Reef's racers and portraits; the ability wording is still Reef's until lane 1/c. */
const FARSIDE_CAST: CastSkin = { ...REEF_CAST };

/** Reef's object textures and words until lane 1/c. */
const FARSIDE_OBJECTS: ObjectSkin = { ...REEF_OBJECTS };

/** Farside as the engine draws it. */
export const FARSIDE_SKIN: WorldSkin = {
  id: 'farside',
  cast: FARSIDE_CAST,
  objects: FARSIDE_OBJECTS,
  registerTextures: () => {},
};
