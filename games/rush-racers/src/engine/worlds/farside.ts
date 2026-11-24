/**
 * Farside's world skin: wiring only. The cast is in `farside/cast.ts`, the objects in
 * `farside/objects.ts` and their texture keys in `farside/keys.ts`.
 */
import { FARSIDE_CAST, registerFarsideCast } from './farside/cast.ts';
import { FARSIDE_OBJECTS, registerFarsideObjects } from './farside/objects.ts';
import type { WorldSkin } from './types.ts';

/** Farside as the engine draws it. */
export const FARSIDE_SKIN: WorldSkin = {
  id: 'farside',
  cast: FARSIDE_CAST,
  objects: FARSIDE_OBJECTS,
  moveSound: 'burns',
  registerTextures(scene) {
    registerFarsideCast(scene);
    registerFarsideObjects(scene);
  },
};
