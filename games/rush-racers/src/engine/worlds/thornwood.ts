/**
 * Thornwood's world skin. Scaffold placeholder: Reef's art and words under Thornwood's id, so a
 * Thornwood course boots. Phase 2 lane c gives it Thornwood's words; phase 3 its own art.
 */
import { REEF_CAST } from './reef/cast.ts';
import { REEF_OBJECTS } from './reef/objects.ts';
import type { WorldSkin } from './types.ts';

/** Thornwood as the engine draws it. */
export const THORNWOOD_SKIN: WorldSkin = {
  id: 'thornwood',
  cast: REEF_CAST,
  objects: REEF_OBJECTS,
  registerTextures: () => {},
};
