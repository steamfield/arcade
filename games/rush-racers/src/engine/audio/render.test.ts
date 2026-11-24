import { describe, expect, it } from 'vitest';
import { encodeWav } from './render.ts';

/** The four ASCII bytes at `offset`. */
function tag(view: DataView, offset: number): string {
  return String.fromCharCode(...[0, 1, 2, 3].map((i) => view.getUint8(offset + i)));
}

describe('encodeWav', () => {
  const pcm = new Float32Array([0, 0.5, -0.5, 1, -1, 3, -3]);

  /** The WAV bytes of `pcm` at 22.05 kHz and a view to read them. */
  function encoded(): { wav: Uint8Array; view: DataView } {
    const wav = encodeWav(pcm, 22050);
    return { wav, view: new DataView(wav.buffer, wav.byteOffset, wav.byteLength) };
  }

  it('writes a 44-byte RIFF header for 16-bit mono PCM at the sample rate', () => {
    const { view } = encoded();
    expect({
      riff: tag(view, 0),
      riffSize: view.getUint32(4, true),
      wave: tag(view, 8),
      fmt: tag(view, 12),
      fmtSize: view.getUint32(16, true),
      format: view.getUint16(20, true),
      channels: view.getUint16(22, true),
      sampleRate: view.getUint32(24, true),
      byteRate: view.getUint32(28, true),
      blockAlign: view.getUint16(32, true),
      bitsPerSample: view.getUint16(34, true),
      data: tag(view, 36),
    }).toEqual({
      riff: 'RIFF',
      riffSize: 36 + 14,
      wave: 'WAVE',
      fmt: 'fmt ',
      fmtSize: 16,
      format: 1,
      channels: 1,
      sampleRate: 22050,
      byteRate: 44100,
      blockAlign: 2,
      bitsPerSample: 16,
      data: 'data',
    });
  });

  it('declares and holds two bytes per sample after the header', () => {
    const { wav, view } = encoded();
    expect(view.getUint32(40, true)).toBe(pcm.length * 2);
    expect(wav.byteLength).toBe(44 + pcm.length * 2);
  });

  it('writes samples as signed 16-bit and clamps those outside -1..1', () => {
    const { view } = encoded();
    const samples = Array.from(pcm, (_, i) => view.getInt16(44 + i * 2, true));
    expect(samples).toEqual([0, 16384, -16384, 32767, -32768, 32767, -32768]);
  });
});
