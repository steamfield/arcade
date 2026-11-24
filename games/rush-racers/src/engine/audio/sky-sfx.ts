/**
 * The sky set pieces' sound effects as data, in `sfx.ts`'s part notation: a flap, a bounce off a
 * cloud, a boost ring, a storm zone's warning and its strike. Each is a few synth parts offset in
 * time, under half a second, and quieter than the core effects so they sit under the race song;
 * `playSkySfx` schedules them.
 */
import { hiss, type Part, playParts, pulse, type SfxVariation, tri } from './sfx.ts';
import { env, type Synth } from './synth.ts';

/** Every sky set-piece effect. */
export type SkySfxKey = 'flap' | 'bounce' | 'ring' | 'lightning.warn' | 'lightning.strike';

const SKY_SFX: Record<SkySfxKey, readonly Part[]> = {
  // A wingbeat: a soft upward rush of air. Flaps come several a second, so it stays light.
  flap: [hiss('bandpass', 900, 0, 0.08, 0.18, { sweepTo: 1900, envelope: env(0.01, 0.05, 0.3, 0.03) })],
  // A spring: a triangle boing that slides up an octave, with a little wobble on top.
  bounce: [tri(52, 0, 0.2, 0.4, { slide: 12 }), pulse(64, 0.02, 0.16, 0.15, { duty: 0.25, slide: 12, vibrato: true })],
  // Through a ring: a quick rising three-note chime with a breath of air under it.
  ring: [
    pulse(79, 0, 0.05, 0.22, { duty: 0.125 }),
    pulse(86, 0.05, 0.05, 0.22, { duty: 0.125 }),
    pulse(91, 0.1, 0.14, 0.22, { duty: 0.125, vibrato: true }),
    hiss('highpass', 2400, 0, 0.12, 0.12),
  ],
  // The storm gathering: a low rumble that swells, with a faint crackle on top.
  'lightning.warn': [
    hiss('lowpass', 260, 0, 0.42, 0.32, { sweepTo: 520, envelope: env(0.12, 0.15, 0.6, 0.1) }),
    hiss('bandpass', 4000, 0.18, 0.05, 0.1),
    hiss('bandpass', 3200, 0.3, 0.04, 0.08),
  ],
  // The strike: a sharp crack, then a falling boom.
  'lightning.strike': [
    hiss('highpass', 3000, 0, 0.05, 0.4),
    hiss('lowpass', 900, 0.03, 0.4, 0.4, { sweepTo: 140, envelope: env(0.005, 0.12, 0.5, 0.1) }),
    tri(33, 0.03, 0.35, 0.4, { slide: -5 }),
  ],
};

/** Whether `key` names a sky set-piece effect rather than one of `sfx.ts`'s. */
export function isSkySfx(key: string): key is SkySfxKey {
  return Object.hasOwn(SKY_SFX, key);
}

/**
 * Schedules sky effect `key` into `out` starting at context time `at`.
 *
 * @throws {Error} When WebAudio refuses to create or schedule one of its nodes.
 */
export function playSkySfx(
  synth: Synth,
  out: AudioNode,
  key: SkySfxKey,
  at: number,
  variation: SfxVariation = {},
): void {
  playParts(synth, out, SKY_SFX[key], at, variation);
}
