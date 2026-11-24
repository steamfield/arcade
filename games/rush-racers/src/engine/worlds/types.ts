/**
 * What a world skin is: everything the engine draws or words differently per world, keyed by the
 * world's id. A world's cast and object art are split so each can be built on its own. A skin is
 * data only; the textures it names are drawn by its world's `art.ts`, through `WORLD_ART`.
 */
import type { ShippedWorldId } from '../../logic/worlds/types.ts';
import type { CastSkin } from './cast-skin.ts';
import type { ObjectSkin } from './object-skin.ts';

/** A world as the engine draws it. */
export interface WorldSkin {
  /** The logic world's id (`WorldDef.id`). */
  id: ShippedWorldId;
  cast: CastSkin;
  objects: ObjectSkin;
}
