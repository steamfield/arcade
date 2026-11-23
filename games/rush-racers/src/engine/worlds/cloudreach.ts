/**
 * Cloudreach's world skin. Scaffold placeholder: Reef's art and words under Cloudreach's id, so a
 * Cloudreach course boots. Phase 1 lane c gives it Cloudreach's words; phase 3 its own art.
 */
import { REEF_CAST } from './reef/cast.ts';
import { REEF_OBJECTS } from './reef/objects.ts';
import type { WorldSkin } from './types.ts';

/** Cloudreach as the engine draws it. */
export const CLOUDREACH_SKIN: WorldSkin = {
  id: 'cloudreach',
  cast: REEF_CAST,
  objects: REEF_OBJECTS,
  registerTextures: () => {},
};
