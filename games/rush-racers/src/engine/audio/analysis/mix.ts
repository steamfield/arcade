/**
 * A song's loudest instant, estimated from voice levels without rendering audio.
 */
import type { Song } from '../notation.ts';

/** The largest sum over channels of `voice.level * velocity` of notes sounding together, and where (1-based). */
export function peakLevel(_song: Song): { level: number; bar: number; beat: number } {
  throw new Error('not implemented');
}
