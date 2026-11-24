/**
 * Turns one note event into synth calls at a time on the audio clock. The sequencer and the
 * offline renderer both play songs through it. It owns what the notation's note fields sound
 * like: duty overrides, voice detune, arpeggio steps and the triangle's pitch drop.
 */
import type { ChannelVoice, NoteEvent, Song } from './notation.ts';
import { env, midiToHz, type Synth } from './synth.ts';

type ToneSpec = Parameters<Synth['tone']>[1];
type FrequencyPoint = NonNullable<ToneSpec['steps']>[number];

/** Arpeggio steps are counted in frames of the hardware's 60 Hz refresh. */
const FRAME_SECONDS = 1 / 60;
const DEFAULT_ARP_FRAMES = 2;
/** A drop starts this many semitones above the written pitch and ends this many below it. */
const DROP_START_ABOVE = 24;
const DROP_END_BELOW = 12;
/** Seconds a drop takes to fall from its start to the written pitch. */
const DROP_SETTLE = 0.05;
/** Seconds a drop takes to decay to silence when the note is long enough. */
const DROP_DECAY = 0.12;
const DROP_ATTACK = 0.001;
const DROP_RELEASE = 0.005;

/**
 * Plays `note` of `song` at `time` (context seconds) into `out`, on its channel's voice, with
 * `secondsPerBeat` turning the note's length into seconds.
 *
 * @throws {Error} When WebAudio refuses to create or schedule a node.
 */
export function playNote(
  synth: Synth,
  out: AudioNode,
  song: Song,
  note: NoteEvent,
  time: number,
  secondsPerBeat: number,
): void {
  const voice = song.voices[note.channel];
  const level = voice.level * note.velocity;
  if (typeof note.pitch !== 'number') {
    synth.drum(out, note.pitch, time, level);
    return;
  }
  const length = note.length * secondsPerBeat;
  const base: ToneSpec = {
    wave: note.channel === 'triangle' ? 'triangle' : 'pulse',
    duty: note.duty ?? voice.duty ?? 0.5,
    frequency: midiToHz(note.pitch),
    at: time,
    length,
    envelope: voice.envelope,
    level,
    ...(voice.detune ? { detune: voice.detune } : {}),
  };
  if (note.drop) {
    synth.tone(out, { ...base, ...dropShape(note.pitch, time, length) });
    return;
  }
  synth.tone(out, {
    ...base,
    ...(note.slideTo !== undefined && { slideTo: midiToHz(note.pitch + note.slideTo) }),
    ...(note.vibrato && { vibrato: true }),
    ...(note.arp && { steps: arpSteps(note.pitch, note.arp, voice, time, length) }),
  });
}

/**
 * The arpeggio's frequency at each step from `time` for `length` seconds, cycling through
 * `offsets` from `pitch`. Steps are wall-clock frames, so a tempo lift doesn't speed them up.
 */
function arpSteps(
  pitch: number,
  offsets: readonly number[],
  voice: ChannelVoice,
  time: number,
  length: number,
): FrequencyPoint[] {
  const stepFrames = voice.arpFrames ?? DEFAULT_ARP_FRAMES;
  // The small epsilon keeps a length that is a whole number of steps from gaining one more.
  const count = Math.max(1, Math.ceil(length / FRAME_SECONDS / stepFrames - 1e-9));
  return Array.from({ length: count }, (_, i) => ({
    frequency: midiToHz(pitch + (offsets[i % offsets.length] ?? 0)),
    at: time + i * stepFrames * FRAME_SECONDS,
  }));
}

/**
 * A triangle thump: two octaves above `pitch`, falling to it within 50 ms and on to an octave
 * below by the note's end, with a fast decay that ignores the voice's envelope.
 */
function dropShape(pitch: number, time: number, length: number): Pick<ToneSpec, 'frequency' | 'glides' | 'envelope'> {
  const end = time + length;
  const settle = Math.min(time + DROP_SETTLE, end);
  const glides: FrequencyPoint[] = [{ frequency: midiToHz(pitch), at: settle }];
  if (end > settle) glides.push({ frequency: midiToHz(pitch - DROP_END_BELOW), at: end });
  return {
    frequency: midiToHz(pitch + DROP_START_ABOVE),
    glides,
    envelope: env(DROP_ATTACK, Math.min(DROP_DECAY, length), 0, DROP_RELEASE),
  };
}
