import { describe, expect, it } from 'vitest';
import { parseLevel } from '../../../logic/level/parse.ts';
import { TILE, type WhirlpoolDef } from '../../../logic/types.ts';
import { whirlpoolMarks } from './whirlpool-view.ts';

const ROOM = `
  ########################
  #1....................F#
  #2....................F#
  #3....................F#
  #4....................F#
  #.....................F#
  #.....................F#
  #.....................F#
  ########################
`;
const CLOCKWISE: WhirlpoolDef = { col: 6, row: 4, radius: 3, push: 220, spin: 1 };
const REVERSED: WhirlpoolDef = { col: 17, row: 4, radius: 4, push: 220, spin: -1 };
const level = parseLevel({ name: 'whirlpools', ascii: ROOM, whirlpools: [CLOCKWISE, REVERSED] });

describe('the whirlpool layer', () => {
  it('shows only course pools, centred and sized to their physics', () => {
    const empty = parseLevel({ name: 'plain water', ascii: ROOM });
    expect(whirlpoolMarks(empty, 30, false)).toEqual([]);
    expect(whirlpoolMarks(level, 0, false)).toEqual([
      { x: 6.5 * TILE, y: 4.5 * TILE, radius: 3 * TILE, spin: 1, angle: 0 },
      { x: 17.5 * TILE, y: 4.5 * TILE, radius: 4 * TILE, spin: -1, angle: 0 },
    ]);
  });

  it('turns the spirals in the flow direction at a given tick, regardless of the earlier frames', () => {
    const atSixty = whirlpoolMarks(level, 60, false);
    expect(atSixty.map((mark) => mark.angle)).toEqual([Math.PI / 2, -Math.PI / 2]);
    whirlpoolMarks(level, 10, false);
    whirlpoolMarks(level, 200, false);
    expect(whirlpoolMarks(level, 60, false)).toEqual(atSixty);
  });

  it('holds both spirals in their visible starting pose under reduced motion', () => {
    const still = whirlpoolMarks(level, 60, true);
    expect(still).toHaveLength(2);
    expect(still).toEqual(whirlpoolMarks(level, 0, false));
    expect(whirlpoolMarks(level, 200, true)).toEqual(still);
  });
});
