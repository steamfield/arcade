/**
 * Pulse duty values and the `duty <pulse>: <value>` directive, which changes the duty of a
 * pulse channel's later notes.
 */
import { failLine } from './errors.ts';
import type { Channel, Duty, Line } from './types.ts';

const DUTIES: readonly number[] = [0.125, 0.25, 0.5, 0.75];
/** The `duty` value that hands a channel back to its voice's own duty. */
const VOICE_DUTY = 'voice';

/** Whether a number is one of the pulse duties 0.125, 0.25, 0.5 and 0.75. */
export function isDuty(value: number): value is Duty {
  return DUTIES.includes(value);
}

/**
 * Reads a `duty <channel>: <value>` directive.
 *
 * @returns The duty for the channel's later notes, or undefined for `voice`, which returns
 *   them to the voice's own duty.
 * @throws {Error} Naming the line when the channel isn't a pulse or the value isn't a duty or `voice`.
 */
export function parseDutyDirective(channel: Channel, value: string, line: Line): Duty | undefined {
  if (channel !== 'pulse1' && channel !== 'pulse2') failLine(line, 'only pulse1 and pulse2 have a duty');
  if (value === VOICE_DUTY) return undefined;
  const duty = Number(value);
  if (value === '' || !isDuty(duty)) failLine(line, 'duty must be 0.125, 0.25, 0.5, 0.75 or voice');
  return duty;
}
