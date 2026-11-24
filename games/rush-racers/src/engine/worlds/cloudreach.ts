/**
 * Cloudreach's world skin: wiring only. The cast is in `cloudreach/cast.ts`, the objects in
 * `cloudreach/objects.ts`, their texture keys and the art owner they draw under in
 * `cloudreach/keys.ts`, and what draws them in `cloudreach/art.ts`.
 */
import { CLOUDREACH_CAST } from './cloudreach/cast.ts';
import { CLOUDREACH_OBJECTS } from './cloudreach/objects.ts';
import type { WorldSkin } from './types.ts';

/** Cloudreach as the engine draws it. */
export const CLOUDREACH_SKIN: WorldSkin = {
  id: 'cloudreach',
  cast: CLOUDREACH_CAST,
  objects: CLOUDREACH_OBJECTS,
  moveMoments: ['dive'],
  fireFlavour: { semitones: 2, noiseScale: 1.6, squareTones: false },
};
