/**
 * Where a parse error happened and how it is reported, shared by every notation stage so
 * all messages name the channel, the 1-based bar, the source line and the token.
 */
import type { Channel } from '../notation.ts';

/** Where in the source a token sits, so every error can point at it. */
export interface Place {
  channel: Channel;
  /** 0-based bar; messages show it 1-based. */
  bar: number;
  line: number;
  token: string;
}

/** A source line, for errors in header lines that have no channel or bar. */
export interface Line {
  number: number;
  text: string;
}

/**
 * Throws a parse error at a token.
 *
 * @throws {Error} Always, as `<channel> bar <n> (line <n>), token "<token>": <detail>`.
 */
export function failAt(place: Place, detail: string): never {
  throw new Error(`${place.channel} bar ${place.bar + 1} (line ${place.line}), token "${place.token}": ${detail}`);
}

/**
 * Throws a parse error at a header line.
 *
 * @throws {Error} Always, as `line <n> "<text>": <detail>`.
 */
export function failLine(line: Line, detail: string): never {
  throw new Error(`line ${line.number} "${line.text}": ${detail}`);
}
