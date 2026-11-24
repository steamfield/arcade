/**
 * Renders a song offline, faster than real time, so its levels can be checked without speakers.
 * `renderSong` drives the real synth on an `OfflineAudioContext`, so it needs a browser and has
 * no Vitest test; `encodeWav` is pure and is tested in `render.test.ts`.
 */
import type { NoteEvent, Song } from './notation.ts';
import { playNote } from './play-note.ts';
import { createSynth, DRUM_RING_OUT } from './synth.ts';

const DEFAULT_SAMPLE_RATE = 44_100;
const WAV_HEADER_BYTES = 44;
const BYTES_PER_SAMPLE = 2;

/** A note placed on the rendered timeline. */
interface Placed {
  note: NoteEvent;
  beat: number;
}

/**
 * Mono PCM of `song`: its intro and `passes` passes of its loop (the whole song for a one-shot),
 * with the last notes rung out. Notes are scheduled at the song's own tempo; no timers run.
 *
 * @throws {Error} When `passes` is not a whole number of at least 1 for a looping song, the
 * browser has no `OfflineAudioContext`, or WebAudio refuses a node.
 */
export async function renderSong(song: Song, options: { passes: number; sampleRate?: number }): Promise<Float32Array> {
  if (song.loopStart !== null && !(Number.isInteger(options.passes) && options.passes >= 1)) {
    throw new Error(
      `Cannot render "${song.name}" for ${options.passes} passes: passes must be a whole number of at least 1.`,
    );
  }
  if (typeof OfflineAudioContext === 'undefined') {
    throw new Error(`Cannot render "${song.name}": OfflineAudioContext is missing. Render in a browser.`);
  }
  const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const secondsPerBeat = 60 / song.bpm;
  const { placed, beats } = timeline(song, options.passes);
  const release = Math.max(DRUM_RING_OUT, ...Object.values(song.voices).map((voice) => voice.envelope.release));
  const frames = Math.ceil((beats * secondsPerBeat + release) * sampleRate);
  const context = new OfflineAudioContext(1, frames, sampleRate);
  const synth = createSynth(context, false);
  const bus = synth.createBus(1);
  for (const { note, beat } of placed) playNote(synth, bus, song, note, beat * secondsPerBeat, secondsPerBeat);
  const buffer = await context.startRendering();
  return buffer.getChannelData(0);
}

/**
 * Every note of the render at its beat, and the render's length in beats: the intro once, then
 * the loop `passes` times back to back, or the whole song once for a one-shot.
 */
function timeline(song: Song, passes: number): { placed: Placed[]; beats: number } {
  if (song.loopStart === null) {
    return { placed: song.notes.map((note) => ({ note, beat: note.start })), beats: song.lengthBeats };
  }
  const loopStart = song.loopStart;
  const loopBeats = song.lengthBeats - loopStart;
  const intro = song.notes.filter((note) => note.start < loopStart).map((note) => ({ note, beat: note.start }));
  const loop = song.notes.filter((note) => note.start >= loopStart);
  const repeats = Array.from({ length: passes }, (_, pass) =>
    loop.map((note) => ({ note, beat: note.start + pass * loopBeats })),
  );
  return { placed: [...intro, ...repeats.flat()], beats: loopStart + passes * loopBeats };
}

/** A 16-bit mono PCM WAV file holding `pcm` at `sampleRate`, samples clamped to -1..1. */
export function encodeWav(pcm: Float32Array, sampleRate: number): Uint8Array {
  const dataBytes = pcm.length * BYTES_PER_SAMPLE;
  const bytes = new Uint8Array(WAV_HEADER_BYTES + dataBytes);
  const view = new DataView(bytes.buffer);
  writeHeader(view, sampleRate, dataBytes);
  pcm.forEach((sample, i) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    // Signed 16-bit is asymmetric: -1 maps to -32768 and 1 to 32767.
    const scaled = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(WAV_HEADER_BYTES + i * BYTES_PER_SAMPLE, Math.round(scaled), true);
  });
  return bytes;
}

/** Writes the RIFF, `fmt ` and `data` chunk headers of a 16-bit mono PCM WAV. */
function writeHeader(view: DataView, sampleRate: number, dataBytes: number): void {
  writeTag(view, 0, 'RIFF');
  view.setUint32(4, WAV_HEADER_BYTES - 8 + dataBytes, true);
  writeTag(view, 8, 'WAVE');
  writeTag(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * BYTES_PER_SAMPLE, true);
  view.setUint16(32, BYTES_PER_SAMPLE, true);
  view.setUint16(34, 8 * BYTES_PER_SAMPLE, true);
  writeTag(view, 36, 'data');
  view.setUint32(40, dataBytes, true);
}

/** Writes a four-character ASCII chunk id at `offset`. */
function writeTag(view: DataView, offset: number, id: string): void {
  for (let i = 0; i < 4; i++) view.setUint8(offset + i, id.charCodeAt(i));
}
