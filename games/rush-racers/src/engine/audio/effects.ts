/**
 * Every sound effect the game has, across its effect sets (`sfx.ts`, `sky-sfx.ts`, `item-sfx.ts`,
 * `move-sfx.ts`), behind one key type, and `playEffect`, which hands a key to the set that owns it.
 */
import { type ItemSfxKey, isItemSfx, playItemSfx } from './item-sfx.ts';
import { isMoveSfx, type MoveSfxKey, playMoveSfx } from './move-sfx.ts';
import { playSfx, type SfxKey } from './sfx.ts';
import { isSkySfx, playSkySfx, type SkySfxKey } from './sky-sfx.ts';
import type { Synth } from './synth.ts';
import type { WorldFlavour } from './world-flavour.ts';

/** Any sound effect key. */
export type EffectKey = SfxKey | SkySfxKey | ItemSfxKey | MoveSfxKey;

/** How one play of an effect varies. */
export interface EffectPlay {
  /** Frequency multiplier, about 0.95..1.05, so repeats don't grate. */
  pitch: number;
  /** The world's colouring; only item fires take it. */
  flavour: WorldFlavour;
}

/**
 * Schedules effect `key` into `out` starting at context time `at`.
 *
 * @throws {Error} When WebAudio refuses to create or schedule one of its nodes.
 */
export function playEffect(synth: Synth, out: AudioNode, key: EffectKey, at: number, play: EffectPlay): void {
  const variation = { pitch: play.pitch };
  if (isItemSfx(key)) playItemSfx(synth, out, key, at, play.flavour, variation);
  else if (isSkySfx(key)) playSkySfx(synth, out, key, at, variation);
  else if (isMoveSfx(key)) playMoveSfx(synth, out, key, at, variation);
  else playSfx(synth, out, key, at, variation);
}
