/**
 * The `echo` directive: one pulse replays the other's notes of a section a little later and quieter.
 */
import type { NoteEvent } from './types.ts';

/** An echo of a section's source notes. */
export interface EchoRequest {
  /** The channel that plays the echo. */
  channel: 'pulse1' | 'pulse2';
  /** Beats between a note and its echo, above 0 and at most 4. */
  delay: number;
  /** The echo's velocity as a multiple of the note's, above 0 and at most 1. */
  level: number;
  /** The beat the section ends at; echoes are cut there. */
  sectionEnd: number;
}

/** The echoing channel's notes for `source`, the echoed channel's notes of one section: monophonic, cut at the section end. */
export function expandEcho(_source: readonly NoteEvent[], _request: EchoRequest): NoteEvent[] {
  throw new Error('not implemented');
}
