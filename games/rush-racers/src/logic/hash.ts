/**
 * A hash of a world's state, so two runs of the same race can be compared with one number: the
 * cross-engine check in tests, and later the desync check between players.
 *
 * The hash is `hashState` from `@arcade/core` over the whole world, so state added to `World` later is
 * covered without anyone listing it.
 */
import { hashState } from '@arcade/core';
import type { World } from './types.ts';

/**
 * Top-level `World` keys left out of the hash: fixed before the first tick, derived from hashed
 * state, or output. Peers comparing hashes must agree on the fixed ones when the race is set up,
 * since the hash will not show a difference in them.
 */
const UNHASHED_WORLD_KEYS: ReadonlySet<string> = new Set([
  'level', // static for a race
  'humans', // which slots people race in, fixed at setup
  'progress', // static for a race
  'nav', // derived from `broken`, which is hashed
  'events', // an output sink, not state
  'recentEvents', // a per-tick buffer of events already emitted
]);

/**
 * A 32-bit unsigned hash of every part of `world` that a race can change.
 *
 * @throws {TypeError} When the world holds a value there is no hashing rule for, or a value that
 *   contains itself, naming its path.
 */
export function hashWorld(world: World): number {
  return hashState(withRngStates(world), { skipKeys: UNHASHED_WORLD_KEYS });
}

/** The world with each rng stream replaced by its state, since the streams are closures. */
function withRngStates(world: World): Record<string, unknown> {
  const rngs = Object.fromEntries(Object.entries(world.rngs).map(([stream, rng]) => [stream, rng.state()]));
  return { ...world, rngs };
}
