/**
 * Song header lines: tempo, time signature and per-channel voice settings, plus the default
 * voices a song starts with.
 */
import { isDuty } from './duty.ts';
import { failLine } from './errors.ts';
import type { Channel, ChannelVoice, Envelope, Line } from './types.ts';

const DEFAULT_ENVELOPE: Envelope = { attack: 0.005, decay: 0.08, sustain: 0.6, release: 0.05 };
const DEFAULT_LEVEL = 0.5;
const MAX_DETUNE_CENTS = 50;
const ARP_FRAMES: readonly number[] = [1, 2, 3];

/** A channel's voice before any `voice` line: level 0.5, a short envelope, and 50% duty on pulses. */
export function defaultVoice(channel: Channel): ChannelVoice {
  const isPulse = channel === 'pulse1' || channel === 'pulse2';
  return { ...(isPulse ? { duty: 0.5 } : {}), envelope: { ...DEFAULT_ENVELOPE }, level: DEFAULT_LEVEL };
}

/**
 * Returns a header's value, which must not be empty.
 *
 * @throws {Error} Naming the line when the value is empty.
 */
export function requireText(value: string, line: Line): string {
  if (value === '') failLine(line, 'needs a value');
  return value;
}

/**
 * Reads `tempo: <bpm>`.
 *
 * @throws {Error} Naming the line when the tempo isn't a positive number.
 */
export function parseTempo(value: string, line: Line): number {
  const bpm = Number(value);
  if (!Number.isFinite(bpm) || bpm <= 0) failLine(line, `tempo must be a positive number of BPM, got "${value}"`);
  return bpm;
}

/**
 * Reads `time: <n>/<d>` and returns beats per bar, counting quarter-note beats (6/8 is 3).
 *
 * @throws {Error} Naming the line when the signature is malformed.
 */
export function parseTime(value: string, line: Line): number {
  const match = /^(\d+)\/(2|4|8)$/.exec(value);
  if (!match || Number(match[1]) < 1) failLine(line, `time must look like "4/4", "3/4" or "6/8", got "${value}"`);
  return (Number(match[1]) * 4) / Number(match[2]);
}

/**
 * Applies `key=value` settings from a `voice <channel>:` line to that channel's voice.
 *
 * @throws {Error} Naming the line for an unknown setting, a bad number, a duty on a non-pulse
 *   channel or outside 0.125/0.25/0.5/0.75, a detune on noise or outside -50..50, or an `arp`
 *   other than 1, 2 or 3 or on noise.
 */
export function applyVoiceSettings(voice: ChannelVoice, channel: Channel, value: string, line: Line): void {
  for (const pair of value.split(/\s+/).filter(Boolean)) {
    const [setting = '', raw = ''] = pair.split('=');
    const number = Number(raw);
    const isNumber = raw !== '' && Number.isFinite(number);
    // Detune is the one setting that bends both ways, so it gets its own range message.
    if (setting === 'detune') {
      if (!isNumber) failLine(line, `"${pair}" needs a number of cents from -50 to 50, e.g. detune=-8`);
      applyDetune(voice, channel, number, line);
      continue;
    }
    if (!isNumber || number < 0) failLine(line, `"${pair}" needs a non-negative number, e.g. level=0.5`);
    if (setting === 'duty') applyDuty(voice, channel, number, line);
    else if (setting === 'arp') applyArpFrames(voice, channel, number, line);
    else applyEnvelopeSetting(voice, setting, number, line);
  }
}

function applyDetune(voice: ChannelVoice, channel: Channel, cents: number, line: Line): void {
  if (channel === 'noise') failLine(line, 'noise has no pitch to detune');
  if (Math.abs(cents) > MAX_DETUNE_CENTS) failLine(line, `detune must be -50..50 cents, got ${cents}`);
  voice.detune = cents;
}

function applyDuty(voice: ChannelVoice, channel: Channel, value: number, line: Line): void {
  if (voice.duty === undefined) failLine(line, `only pulse channels have a duty, not ${channel}`);
  if (!isDuty(value)) failLine(line, `duty must be 0.125, 0.25, 0.5 or 0.75, got ${value}`);
  voice.duty = value;
}

function applyArpFrames(voice: ChannelVoice, channel: Channel, frames: number, line: Line): void {
  if (channel === 'noise') failLine(line, 'noise plays drums, which have no arpeggio');
  if (!isArpFrames(frames)) failLine(line, `arp must be 1, 2 or 3 frames, got ${frames}`);
  voice.arpFrames = frames;
}

function isArpFrames(frames: number): frames is 1 | 2 | 3 {
  return ARP_FRAMES.includes(frames);
}

/** Applies `level` or one of the envelope's settings. */
function applyEnvelopeSetting(voice: ChannelVoice, setting: string, value: number, line: Line): void {
  if (setting === 'level' || setting === 'sustain') {
    if (value > 1) failLine(line, `${setting} must be 0..1, got ${value}`);
    if (setting === 'level') voice.level = value;
    else voice.envelope.sustain = value;
  } else if (setting === 'attack' || setting === 'decay' || setting === 'release') {
    voice.envelope[setting] = value;
  } else {
    failLine(
      line,
      `unknown voice setting "${setting}"; use duty, level, attack, decay, sustain, release, detune or arp`,
    );
  }
}
