/**
 * Reef's world skin, assembled from its cast and objects. Wiring only. Reef's textures are the global
 * art `art/index.ts` builds at boot, so it registers none of its own.
 */
import { REEF_CAST } from './reef/cast.ts';
import { REEF_OBJECTS } from './reef/objects.ts';
import type { WorldSkin } from './types.ts';

/** Reef as the engine draws it. */
export const REEF_SKIN: WorldSkin = {
  id: 'reef',
  cast: REEF_CAST,
  objects: REEF_OBJECTS,
  registerTextures: () => {},
};
