/**
 * The sound each item kind makes when a racer fires it, in `sfx.ts`'s part notation, keyed
 * `fire.<kind>`. Every fire is at most two parts and over within 0.35 s, no bigger than the single
 * generic fire sound it replaced, so a fire never holds more synth voices than that one did.
 * `playItemSfx` colours each fire with the world's flavour (`world-flavour.ts`).
 */
import { POWER_UP_KINDS, type PowerUpKind } from '../../logic/types.ts';
import { hiss, type Part, playParts, pulse, type SfxVariation, tri } from './sfx.ts';
import { env, type Synth } from './synth.ts';
import { flavourParts, type WorldFlavour } from './world-flavour.ts';

/** The fire sound of one item kind. */
export type ItemSfxKey = `fire.${PowerUpKind}`;

const SWELL = env(0.06, 0.12, 0.5, 0.1);

const FIRE: Record<PowerUpKind, readonly Part[]> = {
  // Jet Fins: a whoosh rising into a climbing blip.
  jetFin: [
    hiss('bandpass', 500, 0, 0.22, 0.35, { sweepTo: 3200 }),
    pulse(50, 0, 0.16, 0.25, { duty: 0.125, slide: 12 }),
  ],
  // Bubble Shield: a round wobbling tone with a thinner wobble over it.
  bubbleShield: [tri(64, 0, 0.28, 0.4, { vibrato: true }), pulse(76, 0.02, 0.22, 0.15, { duty: 0.25, vibrato: true })],
  // Puffer: air rushing in as the body swells up.
  puffer: [hiss('lowpass', 300, 0, 0.2, 0.4, { sweepTo: 1400 }), tri(45, 0, 0.18, 0.5, { slide: 9 })],
  // Ink Sac: a wet splat that darkens, over a short sinking thud.
  inkSac: [hiss('lowpass', 1600, 0, 0.12, 0.55, { sweepTo: 250 }), tri(40, 0.02, 0.1, 0.5, { slide: -7 })],
  // Glow Lantern: a bright two-note chime, the second ringing.
  glowLantern: [pulse(88, 0, 0.08, 0.25, { duty: 0.125 }), pulse(95, 0.07, 0.2, 0.22, { duty: 0.125, vibrato: true })],
  // Homing Squid: two quick upward chirps as it launches.
  homingSquid: [
    pulse(79, 0, 0.06, 0.25, { duty: 0.25, slide: 7 }),
    pulse(86, 0.06, 0.08, 0.25, { duty: 0.25, slide: 5 }),
  ],
  // Riptide: one wide rushing hiss that swells and brightens.
  riptide: [hiss('bandpass', 600, 0, 0.3, 0.35, { sweepTo: 2600, envelope: SWELL })],
  // Undertow: a tone pulled down more than an octave under a darkening hiss.
  undertow: [
    tri(55, 0, 0.3, 0.4, { slide: -14 }),
    hiss('bandpass', 1400, 0, 0.3, 0.25, { sweepTo: 300, envelope: SWELL }),
  ],
  // Mimic: a high shimmer, two wavering tones a fifth apart.
  mimic: [
    pulse(84, 0, 0.25, 0.18, { duty: 0.125, vibrato: true, slide: 5 }),
    pulse(91, 0.04, 0.22, 0.12, { duty: 0.125, vibrato: true }),
  ],
  // Cannonball: a low boom with a falling rumble under it.
  cannonball: [tri(33, 0, 0.3, 0.7, { slide: -5 }), hiss('lowpass', 500, 0, 0.25, 0.45, { sweepTo: 120 })],
};

const KEYS: ReadonlySet<string> = new Set(POWER_UP_KINDS.map(itemSfxKey));

/** The key of the sound firing an item of `kind` makes. */
export function itemSfxKey(kind: PowerUpKind): ItemSfxKey {
  return `fire.${kind}`;
}

/** Whether `key` names an item fire sound. */
export function isItemSfx(key: string): key is ItemSfxKey {
  return KEYS.has(key);
}

/**
 * Schedules item fire `key` into `out` from context time `at`, coloured by `flavour`.
 *
 * @throws {Error} When WebAudio refuses to create or schedule one of its nodes.
 */
export function playItemSfx(
  synth: Synth,
  out: AudioNode,
  key: ItemSfxKey,
  at: number,
  flavour: WorldFlavour,
  variation: SfxVariation = {},
): void {
  const kind = key.slice('fire.'.length) as PowerUpKind;
  playParts(synth, out, flavourParts(FIRE[kind], flavour), at, variation);
}
