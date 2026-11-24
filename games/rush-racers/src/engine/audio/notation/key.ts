/**
 * The `key:` header: reads a tonic and mode into the song's declared key.
 */
import type { Line, SongKey } from './types.ts';

/**
 * Reads `key: <tonic> <mode>`, e.g. `D dorian`.
 *
 * @throws {Error} Naming the line and listing the modes when the tonic or mode is unknown.
 */
export function parseKey(_value: string, _line: Line): SongKey {
  throw new Error('not implemented');
}
