/**
 * A small chip synthesizer on WebAudio, shaped like classic handheld hardware:
 * pulse waves with four duty cycles, a triangle bass and a filtered noise
 * channel for drums and effects. Every sound is one short-lived oscillator or
 * buffer source with its own envelope gain, scheduled on the AudioContext clock.
 * It knows nothing about songs or game events; the sequencer and SFX call it.
 */
import { createRng } from '@arcade/core';
import type { Drum, Duty, Envelope } from './notation.ts';

/** A pitched note on a pulse or triangle voice. Times are AudioContext seconds. */
interface ToneSpec {
  wave: 'pulse' | 'triangle';
  /** Pulse duty; ignored by the triangle. Defaults to 50%. */
  duty?: Duty;
  frequency: number;
  at: number;
  /** Seconds from `at` until the release starts. */
  length: number;
  envelope: Envelope;
  /** Peak gain, 0..1. */
  level: number;
  /** Frequency reached by the end of `length`, for a pitch slide. */
  slideTo?: number;
  vibrato?: boolean;
}

/** A burst of filtered white noise, for drums and whooshes. */
interface NoiseSpec {
  at: number;
  length: number;
  envelope: Envelope;
  level: number;
  filter: BiquadFilterType;
  /** Filter cutoff or centre in Hz at `at`. */
  frequency: number;
  /** Cutoff reached by the end of `length`, for a sweep. */
  sweepTo?: number;
}

/** The synthesizer. Every play method schedules nodes into `out`, which should lead to `master`. */
export interface Synth {
  readonly context: AudioContext;
  /** The one gain every sound passes through; mute sets it to zero. */
  readonly master: GainNode;
  /** A gain stage at `level` feeding `master`, for a song or the SFX mix. */
  createBus(level: number): GainNode;
  /** @throws {Error} When WebAudio refuses to create or schedule a node. */
  tone(out: AudioNode, spec: ToneSpec): void;
  /** @throws {Error} When WebAudio refuses to create or schedule a node. */
  noise(out: AudioNode, spec: NoiseSpec): void;
  /** @throws {Error} When WebAudio refuses to create or schedule a node. */
  drum(out: AudioNode, drum: Drum, at: number, level: number): void;
  setMuted(muted: boolean): void;
}

const DUTIES: readonly Duty[] = [0.125, 0.25, 0.5, 0.75];
/** Enough harmonics for a bright pulse without aliasing at lead-melody pitches. */
const HARMONICS = 48;
const VIBRATO_HZ = 5.5;
/** Vibrato depth as a fraction of the note's frequency (about a sixth of a semitone). */
const VIBRATO_DEPTH = 0.01;
/** Vibrato waits this long so short notes stay clean and long ones bloom. */
const VIBRATO_DELAY = 0.12;
/** A mute fades over this many seconds so it doesn't click. */
const MUTE_FADE = 0.02;
/** Fixed seed for the noise buffer: the hiss is the same every run, like the hardware's LFSR. */
const NOISE_SEED = 0x6e6f6973;

const DRUMS: Record<Drum, Omit<NoiseSpec, 'at' | 'level'>> = {
  kick: { length: 0.03, envelope: env(0.001, 0.08, 0, 0.02), filter: 'lowpass', frequency: 900, sweepTo: 120 },
  snare: { length: 0.06, envelope: env(0.001, 0.12, 0.2, 0.05), filter: 'bandpass', frequency: 2200 },
  hat: { length: 0.015, envelope: env(0.001, 0.03, 0, 0.01), filter: 'highpass', frequency: 7000 },
  openHat: { length: 0.04, envelope: env(0.001, 0.18, 0, 0.03), filter: 'highpass', frequency: 7000 },
  crash: { length: 0.08, envelope: env(0.001, 0.6, 0, 0.1), filter: 'highpass', frequency: 4000 },
  tom: { length: 0.05, envelope: env(0.001, 0.15, 0, 0.03), filter: 'lowpass', frequency: 600, sweepTo: 150 },
};

/**
 * Builds the synth on `context`: the master gain, one PeriodicWave per pulse duty and
 * a one-second white noise buffer, all made once and reused by every note.
 *
 * @throws {Error} When WebAudio refuses to create the master chain.
 */
export function createSynth(context: AudioContext, muted: boolean): Synth {
  const master = context.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(context.destination);
  const pulses = new Map(DUTIES.map((duty) => [duty, pulseWave(context, duty)]));
  const noiseBuffer = whiteNoise(context);

  const synth: Synth = {
    context,
    master,
    createBus(level) {
      const bus = context.createGain();
      bus.gain.value = level;
      bus.connect(master);
      return bus;
    },
    tone(out, spec) {
      const osc = context.createOscillator();
      if (spec.wave === 'triangle') osc.type = 'triangle';
      else osc.setPeriodicWave(pulses.get(spec.duty ?? 0.5) ?? pulseWave(context, 0.5));
      osc.frequency.setValueAtTime(spec.frequency, spec.at);
      if (spec.slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(spec.slideTo, spec.at + spec.length);
      const end = playThroughEnvelope(context, osc, out, spec);
      if (spec.vibrato) addVibrato(context, osc, spec.frequency, spec.at, end);
    },
    noise(out, spec) {
      const source = context.createBufferSource();
      source.buffer = noiseBuffer;
      source.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = spec.filter;
      filter.frequency.setValueAtTime(spec.frequency, spec.at);
      if (spec.sweepTo !== undefined)
        filter.frequency.exponentialRampToValueAtTime(spec.sweepTo, spec.at + spec.length);
      source.connect(filter);
      playThroughEnvelope(context, source, out, spec, filter);
    },
    drum(out, drum, at, level) {
      synth.noise(out, { ...DRUMS[drum], at, level });
    },
    setMuted(isMuted) {
      const now = context.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(isMuted ? 0 : 1, now + MUTE_FADE);
    },
  };
  return synth;
}

/** Converts a MIDI note number to Hz (A4 = 69 = 440 Hz). */
export function midiToHz(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

/** Shorthand for an envelope literal. */
export function env(attack: number, decay: number, sustain: number, release: number): Envelope {
  return { attack, decay, sustain, release };
}

/**
 * Routes `source` (through `via` when given) into a fresh envelope gain on `out`, starts it
 * at `at` and stops it once the release has finished. Returns that stop time.
 */
function playThroughEnvelope(
  context: AudioContext,
  source: AudioScheduledSourceNode,
  out: AudioNode,
  spec: { at: number; length: number; envelope: Envelope; level: number },
  via?: AudioNode,
): number {
  const gain = context.createGain();
  const end = shapeEnvelope(gain.gain, spec.at, spec.length, spec.envelope, spec.level);
  (via ?? source).connect(gain);
  gain.connect(out);
  source.start(spec.at);
  source.stop(end);
  // Each note owns its nodes; dropping them once it stops lets the graph stay small over a long race.
  source.onended = () => gain.disconnect();
  return end;
}

/**
 * Schedules attack, decay to sustain, hold until `length`, then release on `param`.
 * A note shorter than its attack and decay is cut into its release where it ends.
 */
function shapeEnvelope(param: AudioParam, at: number, length: number, envelope: Envelope, peak: number): number {
  const noteEnd = at + Math.max(length, 0.005);
  const attackEnd = Math.min(at + Math.max(envelope.attack, 0.001), noteEnd);
  const decayEnd = Math.min(attackEnd + envelope.decay, noteEnd);
  param.setValueAtTime(0, at);
  param.linearRampToValueAtTime(peak, attackEnd);
  param.linearRampToValueAtTime(peak * envelope.sustain, decayEnd);
  param.setValueAtTime(peak * envelope.sustain, noteEnd);
  const end = noteEnd + Math.max(envelope.release, 0.005);
  param.linearRampToValueAtTime(0, end);
  return end;
}

/** Wobbles `osc` with a sine LFO from shortly after `at` until `end`. */
function addVibrato(context: AudioContext, osc: OscillatorNode, frequency: number, at: number, end: number): void {
  const lfo = context.createOscillator();
  lfo.frequency.value = VIBRATO_HZ;
  const depth = context.createGain();
  depth.gain.setValueAtTime(0, at);
  depth.gain.linearRampToValueAtTime(frequency * VIBRATO_DEPTH, Math.min(at + VIBRATO_DELAY, end));
  lfo.connect(depth);
  depth.connect(osc.frequency);
  lfo.start(at);
  lfo.stop(end);
  lfo.onended = () => depth.disconnect();
}

/**
 * A pulse wave of the given duty as Fourier coefficients: the n-th harmonic of a pulse
 * high for `duty` of the period is (2 / nπ)·sin(nπ·duty), phase-shifted by nπ·duty.
 */
function pulseWave(context: AudioContext, duty: Duty): PeriodicWave {
  const real = new Float32Array(HARMONICS + 1);
  const imag = new Float32Array(HARMONICS + 1);
  for (let n = 1; n <= HARMONICS; n++) {
    const amplitude = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
    real[n] = amplitude * Math.cos(n * Math.PI * duty);
    imag[n] = amplitude * Math.sin(n * Math.PI * duty);
  }
  return context.createPeriodicWave(real, imag);
}

/** One second of white noise, looped by every noise voice. */
function whiteNoise(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const data = buffer.getChannelData(0);
  const rng = createRng(NOISE_SEED);
  for (let i = 0; i < data.length; i++) data[i] = rng.next() * 2 - 1;
  return buffer;
}
