/**
 * Thornwood's world skin: wiring only. The cast is in `thornwood/cast.ts`, the objects in
 * `thornwood/objects.ts` and their texture keys in `thornwood/keys.ts`.
 */
import { registerThornwoodCast, THORNWOOD_CAST } from './thornwood/cast.ts';
import { registerThornwoodObjects, THORNWOOD_OBJECTS } from './thornwood/objects.ts';
import type { WorldSkin } from './types.ts';

/** Thornwood as the engine draws it. */
export const THORNWOOD_SKIN: WorldSkin = {
  id: 'thornwood',
  cast: THORNWOOD_CAST,
  objects: THORNWOOD_OBJECTS,
  registerTextures(scene) {
    registerThornwoodCast(scene);
    registerThornwoodObjects(scene);
  },
};
