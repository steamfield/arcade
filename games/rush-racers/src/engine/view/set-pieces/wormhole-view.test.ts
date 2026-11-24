import { describe, expect, it } from 'vitest';
import { TILE, type WormholeDef } from '../../../logic/types.ts';
import { wormholeMarks } from './wormhole-view.ts';

const SHORTCUT: WormholeDef = { a: [3, 3], b: [19, 3], oneWay: false };
const LOOP_BACK: WormholeDef = { a: [11, 6], b: [2, 6], oneWay: true };

describe('wormhole mouths on the race screen', () => {
  it('has nothing to draw on a course without wormholes', () => {
    expect(wormholeMarks([], 0, false)).toEqual([]);
  });

  it('matches the colours of paired mouths and draws an inward spiral at entries only', () => {
    const marks = wormholeMarks([SHORTCUT, LOOP_BACK], 0, false);

    expect(marks.map(({ x, y, entry }) => [x / TILE, y / TILE, entry])).toEqual([
      [3.5, 3.5, true],
      [19.5, 3.5, true],
      [11.5, 6.5, true],
      [2.5, 6.5, false],
    ]);
    expect(marks[0]?.colour).toBe(marks[1]?.colour);
    expect(marks[2]?.colour).toBe(marks[3]?.colour);
    expect(marks[0]?.colour).not.toBe(marks[2]?.colour);
  });

  it('keeps a distinct rim colour for each pair when the course has more pairs than base colours', () => {
    const holes = Array.from(
      { length: 15 },
      (_, index): WormholeDef => ({
        a: [2, 3 * index],
        b: [9, 3 * index],
        oneWay: false,
      }),
    );
    const colours = wormholeMarks(holes, 0, false).map(({ colour }) => colour);

    expect(new Set(colours)).toHaveLength(holes.length);
    expect(colours.filter((_, index) => index % 2 === 0)).toEqual(colours.filter((_, index) => index % 2 === 1));
  });

  it('turns by logic tick and keeps a readable still shape under reduced motion', () => {
    const still = wormholeMarks([SHORTCUT, LOOP_BACK], 0, false);
    const turned = wormholeMarks([SHORTCUT, LOOP_BACK], 30, false);

    expect(turned.map(({ angle }) => angle)).not.toEqual(still.map(({ angle }) => angle));
    expect(wormholeMarks([SHORTCUT, LOOP_BACK], 30, true)).toEqual(still);
  });
});
