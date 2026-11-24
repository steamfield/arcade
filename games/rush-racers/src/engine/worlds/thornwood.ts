/**
 * Thornwood's world skin: wiring only. The cast is in `thornwood/cast.ts`, the objects in
 * `thornwood/objects.ts`, their texture keys in `thornwood/keys.ts` and what draws them in
 * `thornwood/art.ts`.
 */
import { THORNWOOD_CAST } from './thornwood/cast.ts';
import { THORNWOOD_OBJECTS } from './thornwood/objects.ts';
import type { WorldSkin } from './types.ts';

/** Thornwood as the engine draws it. */
export const THORNWOOD_SKIN: WorldSkin = {
  id: 'thornwood',
  cast: THORNWOOD_CAST,
  objects: THORNWOOD_OBJECTS,
  moveSound: 'steps',
  moveMoments: ['land', 'skid'],
  fireFlavour: { semitones: -3, noiseScale: 0.55, squareTones: false },
};
