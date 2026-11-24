/**
 * Cloudreach's world skin: wiring only. The cast is in `cloudreach/cast.ts`, the objects in
 * `cloudreach/objects.ts`, their texture keys in `cloudreach/keys.ts` and the art owner they draw
 * under in `cloudreach/owner.ts`.
 */
import { CLOUDREACH_CAST, registerCloudreachCast } from './cloudreach/cast.ts';
import { CLOUDREACH_OBJECTS, registerCloudreachObjects } from './cloudreach/objects.ts';
import type { WorldSkin } from './types.ts';

/** Cloudreach as the engine draws it. */
export const CLOUDREACH_SKIN: WorldSkin = {
  id: 'cloudreach',
  cast: CLOUDREACH_CAST,
  objects: CLOUDREACH_OBJECTS,
  moveMoments: ['dive'],
  fireFlavour: { semitones: 2, noiseScale: 1.6, squareTones: false },
  registerTextures(scene) {
    registerCloudreachCast(scene);
    registerCloudreachObjects(scene);
  },
};
