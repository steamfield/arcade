/**
 * Farside's world skin: wiring only. The cast is in `farside/cast.ts`, the objects in
 * `farside/objects.ts`, their texture keys in `farside/keys.ts` and what draws them in
 * `farside/art.ts`.
 */
import { FARSIDE_CAST } from './farside/cast.ts';
import { FARSIDE_OBJECTS } from './farside/objects.ts';
import type { WorldSkin } from './types.ts';

/** Farside as the engine draws it. */
export const FARSIDE_SKIN: WorldSkin = {
  id: 'farside',
  cast: FARSIDE_CAST,
  objects: FARSIDE_OBJECTS,
  moveSound: 'burns',
  moveMoments: ['thrust'],
  fireFlavour: { semitones: 0, noiseScale: 1, squareTones: true },
};
