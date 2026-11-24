/**
 * Reef's world skin: wiring only. The cast is in `reef/cast.ts`, the objects in `reef/objects.ts`
 * and their texture keys in `reef/keys.ts`. Its racers, portraits, pickups, items, attacks, enemies
 * and hazards are Reef's own art, drawn by `reef/art.ts`; only the HUD item icons live in the UI
 * kit's shared `ui-icons`.
 */
import { REEF_CAST } from './reef/cast.ts';
import { REEF_OBJECTS } from './reef/objects.ts';
import type { WorldSkin } from './types.ts';

/** Reef as the engine draws it. */
export const REEF_SKIN: WorldSkin = {
  id: 'reef',
  cast: REEF_CAST,
  objects: REEF_OBJECTS,
};
