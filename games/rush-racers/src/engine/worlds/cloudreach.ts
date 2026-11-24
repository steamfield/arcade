/**
 * Cloudreach's world skin: wiring only. The cast is in `cloudreach/cast.ts`, the objects in
 * `cloudreach/objects.ts`, and their texture keys and the art owner they draw under in
 * `cloudreach/keys.ts`.
 */
import { CLOUDREACH_CAST, registerCloudreachCast } from './cloudreach/cast.ts';
import { CLOUDREACH_OBJECTS, registerCloudreachObjects } from './cloudreach/objects.ts';
import type { WorldSkin } from './types.ts';

/** Cloudreach as the engine draws it. */
export const CLOUDREACH_SKIN: WorldSkin = {
  id: 'cloudreach',
  cast: CLOUDREACH_CAST,
  objects: CLOUDREACH_OBJECTS,
  registerTextures(scene) {
    registerCloudreachCast(scene);
    registerCloudreachObjects(scene);
  },
};
