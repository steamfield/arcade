/**
 * The binary messages: one peer's input for a tick, and one peer's world hash at a tick. Inputs are
 * nearly all of a race's traffic, so they are 7 bytes: a kind byte, the tick, and two bytes of input.
 */
import type { TickInput } from '../logic/types.ts';

/** A decoded binary message. */
export type Decoded = { kind: 'inputs'; tick: number; input: TickInput } | { kind: 'hash'; tick: number; hash: number };

/** The input of a peer that is touching nothing, as `decode` returns it. Ticks before the first scheduled input use it. */
export const IDLE_INPUT: TickInput = { move: { x: 0, y: 0 }, kick: false, use: false, cycle: 0, kickHeld: false };

/**
 * One peer's input for `tick`.
 *
 * @throws {Error} When `input.move` is not one of the nine values a digital pad produces.
 */
export function encodeInputs(_tick: number, _input: TickInput): Uint8Array {
  throw new Error('not implemented');
}

/** One peer's world hash at `tick`. */
export function encodeHash(_tick: number, _hash: number): Uint8Array {
  throw new Error('not implemented');
}

/** The message in `bytes`, or null when they are not one this build understands. */
export function decode(_bytes: Uint8Array): Decoded | null {
  throw new Error('not implemented');
}
