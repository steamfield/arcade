/**
 * A hash of a world's state, so two runs of the same race can be compared with one number: the
 * cross-engine check in tests, and later the desync check between players.
 */
import type { World } from './types.ts';

/**
 * A 32-bit unsigned hash of every part of `world` that a race can change.
 *
 * @throws {TypeError} When the world holds a value there is no hashing rule for, naming its path.
 */
export function hashWorld(_world: World): number {
  throw new Error('hashWorld is not implemented');
}
