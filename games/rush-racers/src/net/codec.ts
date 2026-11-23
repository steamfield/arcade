/**
 * The binary messages: one peer's input for a tick, and one peer's world hash at a tick. Inputs are
 * nearly all of a race's traffic, so they are 7 bytes: a kind byte, the tick, and two bytes of input.
 *
 * Input byte 0 holds `move`: bits 0-1 the horizontal field, bits 2-3 the vertical one (0 none,
 * 1 negative, 2 positive). Input byte 1 holds bit 0 `kick`, bit 1 `kickHeld`, bit 2 `use`, and bits
 * 3-4 `cycle` (0 none, 1 next, 2 previous). Every other bit pattern is reserved and rejected.
 */
import type { TickInput } from '../logic/types.ts';

/** A decoded binary message. */
export type Decoded = { kind: 'inputs'; tick: number; input: TickInput } | { kind: 'hash'; tick: number; hash: number };

/** The input of a peer that is touching nothing, as `decode` returns it. Ticks before the first scheduled input use it. */
export const IDLE_INPUT: TickInput = { move: { x: 0, y: 0 }, kick: false, use: false, cycle: 0, kickHeld: false };

const KIND_INPUTS = 1;
const KIND_HASH = 2;
const INPUTS_LENGTH = 7;
const HASH_LENGTH = 9;
/** Bytes of the kind and the tick, ahead of each message's payload. */
const HEADER_LENGTH = 5;

const AXIS_NONE = 0;
const AXIS_NEGATIVE = 1;
const AXIS_POSITIVE = 2;
const MOVE_BITS = 0b1111;

const KICK_BIT = 0b1;
const KICK_HELD_BIT = 0b10;
const USE_BIT = 0b100;
const CYCLE_SHIFT = 3;
const CYCLE_NEXT = 1;
const CYCLE_PREVIOUS = 2;
const BUTTON_BITS = 0b11111;

/**
 * One peer's input for `tick`.
 *
 * @throws {Error} When `input.move` is not one of the nine values a digital pad produces.
 */
export function encodeInputs(tick: number, input: TickInput): Uint8Array {
  const bytes = withHeader(KIND_INPUTS, tick, INPUTS_LENGTH);
  bytes[HEADER_LENGTH] = encodeMove(input.move);
  bytes[HEADER_LENGTH + 1] = encodeButtons(input);
  return bytes;
}

/** One peer's world hash at `tick`. */
export function encodeHash(tick: number, hash: number): Uint8Array {
  const bytes = withHeader(KIND_HASH, tick, HASH_LENGTH);
  new DataView(bytes.buffer).setUint32(HEADER_LENGTH, hash >>> 0, true);
  return bytes;
}

/** The message in `bytes`, or null when they are not one this build understands. */
export function decode(bytes: Uint8Array): Decoded | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const kind = bytes[0];
  if (kind === KIND_INPUTS && bytes.length === INPUTS_LENGTH) {
    const input = decodeInput(bytes[HEADER_LENGTH] ?? 0, bytes[HEADER_LENGTH + 1] ?? 0);
    return input ? { kind: 'inputs', tick: view.getUint32(1, true), input } : null;
  }
  if (kind === KIND_HASH && bytes.length === HASH_LENGTH) {
    return { kind: 'hash', tick: view.getUint32(1, true), hash: view.getUint32(HEADER_LENGTH, true) };
  }
  return null;
}

/** A zeroed message of `length` bytes with its kind and tick written. */
function withHeader(kind: number, tick: number, length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  bytes[0] = kind;
  new DataView(bytes.buffer).setUint32(1, tick, true);
  return bytes;
}

/** The axis field for one component of a move, given whether the move is diagonal. */
function encodeAxis(value: number, diagonal: boolean): number | null {
  const unit = diagonal ? Math.SQRT1_2 : 1;
  if (value === unit) return AXIS_POSITIVE;
  if (value === -unit) return AXIS_NEGATIVE;
  if (value === 0 && !diagonal) return AXIS_NONE;
  return null;
}

function encodeMove(move: TickInput['move']): number {
  const diagonal = move.x !== 0 && move.y !== 0;
  const x = encodeAxis(move.x, diagonal);
  const y = encodeAxis(move.y, diagonal);
  if (x === null || y === null) {
    throw new Error(
      `encodeInputs: move (${move.x}, ${move.y}) is not one of the nine digital moves (each axis -1, 0 or 1, diagonals scaled by Math.SQRT1_2)`,
    );
  }
  return x | (y << 2);
}

function encodeButtons(input: TickInput): number {
  const cycle = input.cycle === 1 ? CYCLE_NEXT : input.cycle === -1 ? CYCLE_PREVIOUS : 0;
  return (
    (input.kick ? KICK_BIT : 0) |
    (input.kickHeld ? KICK_HELD_BIT : 0) |
    (input.use ? USE_BIT : 0) |
    (cycle << CYCLE_SHIFT)
  );
}

/** The sign an axis field stands for, or null for the reserved pattern. */
function axisSign(field: number): number | null {
  if (field === AXIS_NONE) return 0;
  if (field === AXIS_NEGATIVE) return -1;
  if (field === AXIS_POSITIVE) return 1;
  return null;
}

function decodeInput(moveByte: number, buttonByte: number): TickInput | null {
  if ((moveByte & ~MOVE_BITS) !== 0 || (buttonByte & ~BUTTON_BITS) !== 0) return null;
  const x = axisSign(moveByte & 0b11);
  const y = axisSign((moveByte >> 2) & 0b11);
  const cycleField = buttonByte >> CYCLE_SHIFT;
  if (x === null || y === null || cycleField === 0b11) return null;
  const scale = x !== 0 && y !== 0 ? Math.SQRT1_2 : 1;
  return {
    move: { x: x * scale, y: y * scale },
    kick: (buttonByte & KICK_BIT) !== 0,
    use: (buttonByte & USE_BIT) !== 0,
    cycle: cycleField === CYCLE_NEXT ? 1 : cycleField === CYCLE_PREVIOUS ? -1 : 0,
    kickHeld: (buttonByte & KICK_HELD_BIT) !== 0,
  };
}
