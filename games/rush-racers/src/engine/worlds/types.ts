/**
 * What a world skin is: everything the engine draws or words differently per world, keyed by the
 * world's id. A world's cast and object art are split so each can be built on its own. A skin is
 * data only; the textures it names are drawn by its world's `art.ts`, through `WORLD_ART`.
 */
import type { WorldFlavour } from '../audio/world-flavour.ts';
import type { SensedMoment } from '../fx/movement-sense.ts';
import type { CastSkin } from './cast-skin.ts';
import type { ObjectSkin } from './object-skin.ts';

/** A world as the engine draws it and hears it. */
export interface WorldSkin {
  /** The logic world's id (`WorldDef.id`). */
  id: string;
  cast: CastSkin;
  objects: ObjectSkin;
  /**
   * The local racer's own movement sound beyond the medium's events (`audio/move-cues.ts`):
   * footsteps while it runs on the ground, or thruster burns while it speeds up. None when left out.
   */
  moveSound?: 'steps' | 'burns';
  /**
   * The movement moments racers in this world are watched for (`fx/movement-sense.ts`): a runner's
   * landings and skids, a flyer's dives, a drifter's burns. None when left out, as for swimmers.
   */
  moveMoments?: readonly SensedMoment[];
  /** How item fire sounds are coloured in this world (`audio/world-flavour.ts`). The fire sounds as written when left out. */
  fireFlavour?: WorldFlavour;
}
