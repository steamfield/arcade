/**
 * The local racer's movement sounds for the media that have their own, in `sfx.ts`'s part
 * notation: a runner's hop and footsteps, a drifter's thruster burn and its clank off a wall. They
 * come often (a step every few hundred milliseconds), so each is at most three parts, under 0.15 s
 * and quiet, and sits under the race song. Swim's kick and flight's flap live in `sfx.ts` and
 * `sky-sfx.ts`. `playMoveSfx` schedules them.
 */
import { hiss, type Part, playParts, pulse, type SfxVariation, tri } from './sfx.ts';
import { env, type Synth } from './synth.ts';

/** Every movement sound. */
export type MoveSfxKey = 'hop' | 'step' | 'burn' | 'clank';

const TAP = env(0.002, 0.02, 0.4, 0.02);

const MOVE_SFX: Record<MoveSfxKey, readonly Part[]> = {
  // Leaving the ground: a short springy blip up a fifth.
  hop: [tri(52, 0, 0.07, 0.35, { slide: 7 })],
  // A footfall: a soft, dark scuff of noise.
  step: [hiss('lowpass', 700, 0, 0.03, 0.18, { envelope: TAP })],
  // A thruster burn: a low rush of noise over a buzzing square.
  burn: [hiss('lowpass', 380, 0, 0.08, 0.22, { sweepTo: 260 }), pulse(31, 0, 0.07, 0.1, { duty: 0.5, envelope: TAP })],
  // Hull off a wall: two detuned squares ringing metallic over a sharp tick.
  clank: [
    pulse(70, 0, 0.12, 0.25, { duty: 0.5, slide: -2 }),
    pulse(77, 0, 0.08, 0.18, { duty: 0.25 }),
    hiss('highpass', 3000, 0, 0.03, 0.25),
  ],
};

/** Whether `key` names a movement sound. */
export function isMoveSfx(key: string): key is MoveSfxKey {
  return Object.hasOwn(MOVE_SFX, key);
}

/**
 * Schedules movement sound `key` into `out` starting at context time `at`.
 *
 * @throws {Error} When WebAudio refuses to create or schedule one of its nodes.
 */
export function playMoveSfx(
  synth: Synth,
  out: AudioNode,
  key: MoveSfxKey,
  at: number,
  variation: SfxVariation = {},
): void {
  playParts(synth, out, MOVE_SFX[key], at, variation);
}
