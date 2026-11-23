/**
 * The binary codec: every input a digital pad can produce survives the trip through the wire
 * unchanged, and bytes this build does not understand decode to null instead of throwing.
 */
import { describe, expect, it } from 'vitest';
import type { TickInput } from '../logic/types.ts';
import { decode, encodeHash, encodeInputs } from './codec.ts';

const AXES = [-1, 0, 1] as const;
const CYCLES = [-1, 0, 1] as const;
const FLAGS = [false, true] as const;

/** The nine moves `input.vector` produces: each axis -1, 0 or 1, diagonals scaled to length 1. */
const MOVES = AXES.flatMap((x) =>
  AXES.map((y) => {
    const scale = x !== 0 && y !== 0 ? Math.SQRT1_2 : 1;
    return { x: x * scale, y: y * scale };
  }),
);

/** Every input the codec carries: nine moves by kick, kickHeld, use and cycle. */
const EVERY_INPUT: TickInput[] = MOVES.flatMap((move) =>
  FLAGS.flatMap((kick) =>
    FLAGS.flatMap((kickHeld) =>
      FLAGS.flatMap((use) => CYCLES.map((cycle): TickInput => ({ move, kick, kickHeld, use, cycle }))),
    ),
  ),
);

describe('encodeInputs and decode', () => {
  it('round-trip every combination of move, kick, kickHeld, use and cycle to equal values', () => {
    const tick = 0x01020304;
    const decoded = EVERY_INPUT.map((input) => decode(encodeInputs(tick, input)));
    expect(decoded).toEqual(EVERY_INPUT.map((input) => ({ kind: 'inputs', tick, input })));
    expect(EVERY_INPUT).toHaveLength(9 * 2 * 2 * 2 * 3);
  });

  it('throws for a move that is not one of the nine digital values', () => {
    const input: TickInput = { move: { x: 0.5, y: 0 }, kick: false, use: false, cycle: 0 };
    expect(() => encodeInputs(1, input)).toThrow(/move \(0\.5, 0\) is not one of the nine digital moves/);
  });
});

describe('encodeHash and decode', () => {
  it('round-trip a tick and a 32-bit hash', () => {
    expect(decode(encodeHash(600, 0xdeadbeef))).toEqual({ kind: 'hash', tick: 600, hash: 0xdeadbeef });
  });
});

describe('decode', () => {
  const inputs = encodeInputs(7, { move: { x: 1, y: 0 }, kick: true, use: false, cycle: 0 });

  it.each([
    ['empty', new Uint8Array(0)],
    ['short', inputs.slice(0, 6)],
    ['long', Uint8Array.from([...inputs, 0])],
    ['unknown-kind', Uint8Array.from([3, ...inputs.slice(1)])],
  ])('returns null for %s bytes', (_name, bytes) => {
    expect(decode(bytes)).toBeNull();
  });

  /** The inputs message for tick 7 with its move byte and button byte replaced. */
  const inputWith = (moveByte: number, buttonByte: number) =>
    Uint8Array.from([...inputs.slice(0, 5), moveByte, buttonByte]);

  it.each([
    ['the horizontal move field', inputWith(0b0011, 0)],
    ['the vertical move field', inputWith(0b1100, 0)],
    ['the cycle field', inputWith(0, 0b11000)],
    ['an unused bit of the move byte', inputWith(0b10000, 0)],
    ['an unused bit of the button byte', inputWith(0, 0b100000)],
  ])('returns null for an input with the reserved pattern in %s', (_name, bytes) => {
    expect(decode(bytes)).toBeNull();
  });
});
