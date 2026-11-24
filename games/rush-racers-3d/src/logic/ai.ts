/**
 * How a rival drives: one tick's `TickInput` from what a player could see, which is the course's
 * features ahead and the other racers' track positions. Noise comes from `world.rngState` only.
 */
import type { Racer, TickInput, World } from './types.ts';

/**
 * The input `racer` (a rival) gives this tick. May advance `world.rngState` for its noise, and
 * changes nothing else.
 */
export function rivalInput(world: World, racer: Racer): TickInput {
  void world;
  void racer;
  throw new Error('rivalInput: not implemented (phase 2 lane a)');
}
