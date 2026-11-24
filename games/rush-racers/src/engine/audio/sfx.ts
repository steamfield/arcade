/**
 * The game's sound effects as data: each key is a few synth parts (a blip, a
 * slide, a noise burst) offset in time, and `playSfx` schedules them. Every
 * effect is under half a second so repeats never pile up into mush. The part notation (`pulse`,
 * `tri`, `hiss`) and `playParts` are exported so the other effect sets (`sky-sfx.ts`, `item-sfx.ts`,
 * `move-sfx.ts`) use them too.
 */
import type { Duty, Envelope } from './notation.ts';
import { env, midiToHz, type Synth } from './synth.ts';

/** Every effect the game can play. */
export type SfxKey =
  | 'countdown'
  | 'go'
  | 'kick'
  | 'bump'
  | 'place.up'
  | 'place.down'
  | 'finish'
  | 'coral'
  | 'clam'
  | 'powerup.gain'
  | 'powerup.lost'
  | 'squid.fire'
  | 'squid.lock'
  | 'squid.latch'
  | 'squid.dodge'
  | 'squid.shake'
  | 'squid.lost'
  | 'riptide'
  | 'undertow'
  | 'decoy.spawn'
  | 'decoy.pop'
  | 'hit'
  | 'stun'
  | 'pearl'
  | 'pearl.drop'
  | 'menu.move'
  | 'menu.confirm'
  | 'shark.windup'
  | 'eel.warn'
  | 'enemy.bonk'
  | 'enemy.defeat'
  | 'enemy.bite'
  | 'fall'
  | 'respawn';

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

/** One synth part of an effect, offset in time from the effect's start. */
export type Part = TonePart | NoisePart;

/** How a single play of an effect varies. */
export interface SfxVariation {
  /** Frequency multiplier, about 0.95..1.05, so repeats don't grate. */
  pitch?: number;
  /** Shift in semitones, e.g. rising pearl pings. */
  semitones?: number;
}

const BLIP = env(0.002, 0.04, 0.7, 0.04);

/** A pulse-wave part. */
export const pulse = (
  note: number,
  offset: number,
  length: number,
  level: number,
  extra: Partial<TonePart> = {},
): Part => ({
  wave: 'pulse',
  note,
  offset,
  length,
  level,
  ...extra,
});
/** A triangle-wave part. */
export const tri = (
  note: number,
  offset: number,
  length: number,
  level: number,
  extra: Partial<TonePart> = {},
): Part => ({
  wave: 'triangle',
  note,
  offset,
  length,
  level,
  ...extra,
});
/** A filtered noise part. */
export const hiss = (
  filter: BiquadFilterType,
  frequency: number,
  offset: number,
  length: number,
  level: number,
  extra: Partial<NoisePart> = {},
): Part => ({ wave: 'noise', filter, frequency, offset, length, level, ...extra });

/** Rising four-note arpeggio, 45 ms a step. */
const arpeggio = (notes: number[], step: number, level: number, duty: Duty): Part[] =>
  notes.map((note, i) => pulse(note, i * step, step, level, { duty }));

const SFX: Record<SfxKey, readonly Part[]> = {
  // Low A for 3-2-1, the octave above for GO, like a starting light.
  countdown: [pulse(69, 0, 0.12, 0.45)],
  go: [pulse(81, 0, 0.35, 0.45), pulse(88, 0, 0.35, 0.2, { duty: 0.25 })],
  kick: [hiss('bandpass', 600, 0, 0.12, 0.35, { sweepTo: 2400, envelope: env(0.02, 0.08, 0.3, 0.05) })],
  bump: [tri(45, 0, 0.1, 0.7, { slide: -12 }), hiss('lowpass', 400, 0, 0.04, 0.3)],
  'place.up': [pulse(76, 0, 0.06, 0.35, { duty: 0.125 }), pulse(83, 0.06, 0.09, 0.35, { duty: 0.125 })],
  'place.down': [pulse(76, 0, 0.06, 0.35, { duty: 0.125 }), pulse(69, 0.06, 0.1, 0.35, { duty: 0.125 })],
  finish: [
    ...arpeggio([72, 76, 79], 0.07, 0.4, 0.25),
    pulse(84, 0.21, 0.25, 0.4, { duty: 0.25, vibrato: true }),
    tri(60, 0, 0.45, 0.5),
  ],
  coral: [hiss('bandpass', 1800, 0, 0.05, 0.5), hiss('bandpass', 1100, 0.06, 0.07, 0.45)],
  clam: [pulse(67, 0, 0.12, 0.35, { duty: 0.25, slide: 12 }), pulse(79, 0.12, 0.08, 0.3, { duty: 0.25 })],
  'powerup.gain': arpeggio([72, 76, 79, 84], 0.045, 0.35, 0.25),
  'powerup.lost': [pulse(79, 0, 0.25, 0.35, { slide: -12 })],
  // A squid fired: a quick rising hiss.
  'squid.fire': [
    hiss('bandpass', 700, 0, 0.14, 0.3, { sweepTo: 2600 }),
    pulse(55, 0, 0.1, 0.2, { duty: 0.25, slide: 7 }),
  ],
  // Lock-on: three quick climbing pings, urgent but short. Heard only when the squid is after the player.
  'squid.lock': [
    pulse(79, 0, 0.07, 0.3, { duty: 0.25 }),
    pulse(84, 0.08, 0.07, 0.3, { duty: 0.25 }),
    pulse(91, 0.16, 0.12, 0.3, { duty: 0.25 }),
  ],
  // Latched: a wet slap, then a low squelch.
  'squid.latch': [hiss('lowpass', 1500, 0, 0.07, 0.5), tri(50, 0, 0.18, 0.5, { slide: -9 })],
  // A dodge: a bright whoosh past.
  'squid.dodge': [
    hiss('highpass', 1800, 0, 0.18, 0.3, { sweepTo: 600 }),
    pulse(88, 0, 0.08, 0.2, { duty: 0.25, slide: -5 }),
  ],
  // Shaken off: a relieved little pair of notes going up.
  'squid.shake': [pulse(67, 0, 0.06, 0.35, { duty: 0.25 }), pulse(74, 0.06, 0.12, 0.35, { duty: 0.25 })],
  // A squid that fizzled: a short falling blip.
  'squid.lost': [pulse(72, 0, 0.12, 0.25, { duty: 0.125, slide: -10 })],
  // Riptide: a wide rushing swell.
  riptide: [
    hiss('bandpass', 400, 0, 0.3, 0.35, { sweepTo: 1800, envelope: env(0.06, 0.12, 0.5, 0.1) }),
    tri(36, 0, 0.3, 0.45, { slide: 7 }),
  ],
  // Undertow: the same swell run backwards, pulling down.
  undertow: [
    hiss('bandpass', 1800, 0, 0.3, 0.35, { sweepTo: 300, envelope: env(0.06, 0.12, 0.5, 0.1) }),
    tri(48, 0, 0.3, 0.45, { slide: -12 }),
  ],
  'decoy.spawn': [
    pulse(76, 0, 0.05, 0.3, { duty: 0.5 }),
    pulse(76, 0.06, 0.05, 0.2, { duty: 0.125 }),
    pulse(83, 0.12, 0.09, 0.3, { duty: 0.25 }),
  ],
  'decoy.pop': [hiss('bandpass', 3500, 0, 0.06, 0.45), pulse(88, 0, 0.1, 0.3, { duty: 0.125, slide: -12 })],
  hit: [hiss('lowpass', 2000, 0, 0.08, 0.5), pulse(64, 0, 0.12, 0.35, { slide: -7 })],
  stun: [pulse(76, 0, 0.35, 0.25, { duty: 0.25, vibrato: true }), pulse(71, 0, 0.35, 0.15, { duty: 0.25 })],
  pearl: [pulse(84, 0, 0.05, 0.3, { duty: 0.125 }), pulse(91, 0.04, 0.1, 0.3, { duty: 0.125 })],
  // Pearls knocked loose: a quick falling run of five ticks, like beads hitting a floor.
  'pearl.drop': [
    pulse(91, 0, 0.04, 0.25, { duty: 0.125 }),
    pulse(86, 0.04, 0.04, 0.25, { duty: 0.125 }),
    pulse(88, 0.08, 0.04, 0.22, { duty: 0.125 }),
    pulse(81, 0.12, 0.04, 0.2, { duty: 0.125 }),
    pulse(84, 0.16, 0.06, 0.18, { duty: 0.125 }),
  ],
  'menu.move': [pulse(81, 0, 0.03, 0.25, { duty: 0.125 })],
  'menu.confirm': [pulse(76, 0, 0.05, 0.3, { duty: 0.25 }), pulse(83, 0.05, 0.1, 0.3, { duty: 0.25 })],
  // A shark winding up: a low growl swelling under a rising warning whine, as long as its tell.
  'shark.windup': [
    tri(33, 0, 0.42, 0.55, { slide: 5, envelope: env(0.08, 0.1, 0.8, 0.08) }),
    pulse(64, 0.05, 0.36, 0.18, { duty: 0.125, slide: 12, vibrato: true }),
  ],
  // An eel about to strike: three wet bubbles gurgling up out of its hole.
  'eel.warn': [
    pulse(55, 0, 0.05, 0.22, { duty: 0.5, slide: 7 }),
    pulse(58, 0.08, 0.05, 0.22, { duty: 0.5, slide: 7 }),
    pulse(62, 0.16, 0.06, 0.22, { duty: 0.5, slide: 9 }),
    hiss('bandpass', 900, 0, 0.22, 0.15),
  ],
  // A dash bonk: a springy boing up and a thump.
  'enemy.bonk': [tri(52, 0, 0.16, 0.6, { slide: 14 }), hiss('lowpass', 700, 0, 0.05, 0.4)],
  // An enemy beaten: a pop, then a bright run of pearl pings.
  'enemy.defeat': [hiss('bandpass', 2600, 0, 0.06, 0.5), ...arpeggio([79, 84, 88, 91], 0.05, 0.3, 0.125)],
  // An enemy gets the player: a snapping chomp.
  'enemy.bite': [hiss('highpass', 1200, 0, 0.04, 0.5), tri(40, 0.03, 0.14, 0.6, { slide: -10 })],
  // Falling out of play (a pit, a black hole): a two-octave downward sweep over a sinking hiss.
  fall: [
    pulse(79, 0, 0.38, 0.3, { duty: 0.25, slide: -24, envelope: env(0.005, 0.1, 0.7, 0.08) }),
    hiss('bandpass', 2000, 0, 0.35, 0.2, { sweepTo: 200 }),
  ],
  // Back in play: a rising shimmer, two staggered octave climbs over a brightening hiss.
  respawn: [
    pulse(72, 0, 0.3, 0.2, { duty: 0.125, slide: 12, vibrato: true }),
    pulse(79, 0.05, 0.3, 0.15, { duty: 0.125, slide: 12, vibrato: true }),
    hiss('highpass', 3000, 0, 0.35, 0.12, { sweepTo: 7000, envelope: env(0.1, 0.1, 0.6, 0.1) }),
  ],
};

/**
 * Schedules effect `key` into `out` starting at context time `at`.
 *
 * @throws {Error} When WebAudio refuses to create or schedule one of its nodes.
 */
export function playSfx(synth: Synth, out: AudioNode, key: SfxKey, at: number, variation: SfxVariation = {}): void {
  playParts(synth, out, SFX[key], at, variation);
}

/**
 * Schedules `parts` into `out`, each at context time `at` plus its offset.
 *
 * @throws {Error} When WebAudio refuses to create or schedule one of its nodes.
 */
export function playParts(
  synth: Synth,
  out: AudioNode,
  parts: readonly Part[],
  at: number,
  variation: SfxVariation = {},
): void {
  const ratio = (variation.pitch ?? 1) * 2 ** ((variation.semitones ?? 0) / 12);
  for (const part of parts) {
    const start = at + part.offset;
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
      continue;
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
}
