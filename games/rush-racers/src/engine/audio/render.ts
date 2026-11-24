/**
 * Renders a song offline, faster than real time, so its levels can be checked without speakers.
 */
import type { Song } from './notation.ts';

/**
 * Mono PCM of `song`: its intro and `passes` passes of its loop (the whole song for a one-shot),
 * with the last notes rung out.
 *
 * @throws {Error} When the browser has no `OfflineAudioContext` or refuses a node.
 */
export function renderSong(_song: Song, _options: { passes: number; sampleRate?: number }): Promise<Float32Array> {
  throw new Error('not implemented');
}

/** A 16-bit mono PCM WAV file holding `pcm`, samples clamped to -1..1. */
export function encodeWav(_pcm: Float32Array, _sampleRate: number): Uint8Array {
  throw new Error('not implemented');
}
