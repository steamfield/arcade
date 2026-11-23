/**
 * The sky set pieces' sound effects as data, in the same part notation as `sfx.ts`: a flap, a
 * bounce off a cloud, a boost ring, a storm zone's warning and its strike. Each is a few synth
 * parts offset in time, under half a second, and quieter than the core effects so they sit under
 * the race song; `playSkySfx` schedules them.
 */
import type { Duty, Envelope } from './notation.ts';
import type { SfxVariation } from './sfx.ts';
import { env, midiToHz, type Synth } from './synth.ts';

/** Every sky set-piece effect. */
export type SkySfxKey = 'flap' | 'bounce' | 'ring' | 'lightning.warn' | 'lightning.strike';

/** A pitched part. `note` is a MIDI number; `slide` is semitones reached by the end. Times in seconds. */
interface TonePart {
  wave: 'pulse' | 'triangle';
  note: number;
  offset: number;
  length: number;
  level: number;
  duty?: Duty;
  slide?: number;
  vibrato?: boolean;
  envelope?: Envelope;
}

/** A filtered noise part; `frequency` and `sweepTo` are the filter's, in Hz. */
interface NoisePart {
  wave: 'noise';
  offset: number;
  length: number;
  level: number;
  filter: BiquadFilterType;
  frequency: number;
  sweepTo?: number;
  envelope?: Envelope;
}

type Part = TonePart | NoisePart;

const BLIP = env(0.002, 0.04, 0.7, 0.04);

const pulse = (note: number, offset: number, length: number, level: number, extra: Partial<TonePart> = {}): Part => ({
  wave: 'pulse',
  note,
  offset,
  length,
  level,
  ...extra,
});
const tri = (note: number, offset: number, length: number, level: number, extra: Partial<TonePart> = {}): Part => ({
  wave: 'triangle',
  note,
  offset,
  length,
  level,
  ...extra,
});
const hiss = (
  filter: BiquadFilterType,
  frequency: number,
  offset: number,
  length: number,
  level: number,
  extra: Partial<NoisePart> = {},
): Part => ({ wave: 'noise', filter, frequency, offset, length, level, ...extra });

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
  const ratio = (variation.pitch ?? 1) * 2 ** ((variation.semitones ?? 0) / 12);
  for (const part of SKY_SFX[key]) schedulePart(synth, out, part, at + part.offset, ratio);
}

/** Schedules one part at context time `start`, every frequency scaled by `ratio`. */
function schedulePart(synth: Synth, out: AudioNode, part: Part, start: number, ratio: number): void {
  const envelope = part.envelope ?? BLIP;
  if (part.wave === 'noise') {
    synth.noise(out, {
      at: start,
      length: part.length,
      envelope,
      level: part.level,
      filter: part.filter,
      frequency: part.frequency * ratio,
      ...(part.sweepTo !== undefined && { sweepTo: part.sweepTo * ratio }),
    });
    return;
  }
  synth.tone(out, {
    wave: part.wave,
    duty: part.duty ?? 0.5,
    frequency: midiToHz(part.note) * ratio,
    at: start,
    length: part.length,
    envelope,
    level: part.level,
    ...(part.slide !== undefined && { slideTo: midiToHz(part.note + part.slide) * ratio }),
    ...(part.vibrato && { vibrato: true }),
  });
}
