/**
 * The game's sound effects as data: each key is a few synth parts (a blip, a
 * slide, a noise burst) offset in time, and `playSfx` schedules them. Every
 * effect is under half a second so repeats never pile up into mush.
 */
import type { Duty, Envelope } from './notation.ts';
import { env, midiToHz, type Synth } from './synth.ts';

/** Every effect the game can play. Combo keys accent a burst that formed a named combo. */
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
  | 'burst'
  | 'combo.cannonball'
  | 'combo.inkTrail'
  | 'combo.lanternBubble'
  | 'combo.inkBomb'
  | 'combo.comet'
  | 'combo.surfline'
  | 'combo.inkSquid'
  | 'combo.bubbleDecoy'
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
  | 'menu.move'
  | 'menu.confirm';

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

/** How a single play of an effect varies. */
export interface SfxVariation {
  /** Frequency multiplier, about 0.95..1.05, so repeats don't grate. */
  pitch?: number;
  /** Shift in semitones, e.g. rising pearl pings. */
  semitones?: number;
}

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
  burst: [hiss('bandpass', 3000, 0, 0.2, 0.4, { sweepTo: 500 }), pulse(48, 0, 0.15, 0.3, { duty: 0.125, slide: 12 })],
  'combo.cannonball': [tri(43, 0.05, 0.2, 0.6, { slide: -7 }), hiss('lowpass', 500, 0.05, 0.12, 0.4)],
  'combo.inkTrail': [pulse(70, 0.05, 0.08, 0.3, { duty: 0.125 }), pulse(65, 0.13, 0.12, 0.3, { duty: 0.125 })],
  'combo.lanternBubble': [pulse(84, 0.05, 0.08, 0.3, { duty: 0.25 }), pulse(91, 0.13, 0.2, 0.3, { vibrato: true })],
  'combo.inkBomb': [tri(40, 0.05, 0.25, 0.6), hiss('lowpass', 300, 0.05, 0.2, 0.45)],
  'combo.comet': arpeggio([88, 93, 96], 0.04, 0.3, 0.125).map((part) => ({ ...part, offset: part.offset + 0.05 })),
  // Surfline: a rising wash, like a wave lifting the racer.
  'combo.surfline': [
    hiss('bandpass', 500, 0.05, 0.25, 0.3, { sweepTo: 3000 }),
    pulse(72, 0.05, 0.1, 0.25, { duty: 0.25, slide: 12 }),
  ],
  // Ink Squid: a wet pop and a low wobble.
  'combo.inkSquid': [tri(47, 0.05, 0.2, 0.55, { slide: 5, vibrato: true }), hiss('lowpass', 600, 0.05, 0.1, 0.4)],
  // Bubble Decoy: two airy pops, the second higher.
  'combo.bubbleDecoy': [pulse(84, 0.05, 0.05, 0.3, { duty: 0.125 }), pulse(91, 0.11, 0.07, 0.3, { duty: 0.125 })],
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
  'menu.move': [pulse(81, 0, 0.03, 0.25, { duty: 0.125 })],
  'menu.confirm': [pulse(76, 0, 0.05, 0.3, { duty: 0.25 }), pulse(83, 0.05, 0.1, 0.3, { duty: 0.25 })],
};

/**
 * Schedules effect `key` into `out` starting at context time `at`.
 *
 * @throws {Error} When WebAudio refuses to create or schedule one of its nodes.
 */
export function playSfx(synth: Synth, out: AudioNode, key: SfxKey, at: number, variation: SfxVariation = {}): void {
  const ratio = (variation.pitch ?? 1) * 2 ** ((variation.semitones ?? 0) / 12);
  for (const part of SFX[key]) {
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
