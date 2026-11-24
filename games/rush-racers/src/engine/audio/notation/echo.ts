/**
 * The `echo` directive: one pulse replays the other's notes of a section a little later and quieter.
 */
import { failLine } from './errors.ts';
import type { Channel, Line, NoteEvent } from './types.ts';

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

/** A parsed `echo <channel>: <source> delay=<beats> level=<0..1>` line, waiting for its section to close. */
export interface EchoDirective {
  channel: 'pulse1' | 'pulse2';
  source: 'pulse1' | 'pulse2';
  delay: number;
  level: number;
  line: Line;
}

const MAX_DELAY_BEATS = 4;

/**
 * Reads an `echo <channel>: <source> delay=<beats> level=<0..1>` line.
 *
 * @throws {Error} Naming the line when either channel isn't a pulse, a channel echoes itself,
 *   or `delay` or `level` is missing or out of range.
 */
export function parseEchoDirective(channel: Channel, value: string, line: Line): EchoDirective {
  const [source = '', ...settings] = value.split(/\s+/).filter(Boolean);
  if (!isPulse(channel) || !isPulse(source)) {
    failLine(line, 'echo works between the pulses, e.g. "echo pulse2: pulse1 delay=0.75 level=0.45"');
  }
  if (source === channel) failLine(line, `${channel} can't echo itself; name the other pulse`);
  const values = new Map(settings.map((pair) => pair.split('=') as [string, string | undefined]));
  const unknown = [...values.keys()].find((setting) => setting !== 'delay' && setting !== 'level');
  if (unknown !== undefined) failLine(line, `unknown echo setting "${unknown}"; use delay and level`);
  const delay = Number(values.get('delay'));
  const level = Number(values.get('level'));
  if (!(delay > 0 && delay <= MAX_DELAY_BEATS)) {
    failLine(line, `delay must be above 0 and at most 4 beats, got ${values.get('delay') ?? 'none'}`);
  }
  if (!(level > 0 && level <= 1)) {
    failLine(line, `level must be above 0 and at most 1, got ${values.get('level') ?? 'none'}`);
  }
  return { channel, source, delay, level, line };
}

/** The echoing channel's notes for `source`, the echoed channel's notes of one section: monophonic, cut at the section end. */
export function expandEcho(source: readonly NoteEvent[], request: EchoRequest): NoteEvent[] {
  const starts = source.map((note) => note.start + request.delay).filter((start) => start < request.sectionEnd);
  return starts.map((start, index) => {
    const note = source[index] as NoteEvent;
    const end = Math.min(start + note.length, starts[index + 1] ?? request.sectionEnd, request.sectionEnd);
    const { duty: _ownDuty, ...kept } = note;
    return {
      ...kept,
      channel: request.channel,
      start,
      length: end - start,
      velocity: note.velocity * request.level,
      echo: true,
    };
  });
}

function isPulse(channel: string): channel is 'pulse1' | 'pulse2' {
  return channel === 'pulse1' || channel === 'pulse2';
}
