import { describe, expect, it } from 'vitest';
import { spreadHeads } from './race-progress.ts';

const LO = 126;
const HI = 223;
const GAP = 5;
const PLAYER = 0;

/** The smallest gap between any two heads. */
const tightest = (xs: readonly number[]) => {
  const sorted = [...xs].sort((a, b) => a - b);
  return Math.min(...sorted.slice(1).map((x, i) => x - (sorted[i] ?? 0)));
};

describe('the progress strip heads', () => {
  it('leaves heads that are already apart where they are', () => {
    expect(spreadHeads([140, 160, 180, 200], PLAYER, GAP, LO, HI)).toEqual([140, 160, 180, 200]);
  });

  it('keeps the player where they are and fans a bunched pack out, none closer than the gap', () => {
    const drawn = spreadHeads([160, 160, 161, 162], PLAYER, GAP, LO, HI);
    expect(drawn[PLAYER]).toBe(160);
    expect(tightest(drawn)).toBeGreaterThanOrEqual(GAP);
  });

  it('pushes the others away from the player on both sides of them', () => {
    const drawn = spreadHeads([160, 158, 162, 200], PLAYER, GAP, LO, HI);
    expect(drawn).toEqual([160, 155, 165, 200]);
  });

  it('fans the start line pack to the player’s right and keeps them on the strip', () => {
    const drawn = spreadHeads([LO, LO, LO, LO], PLAYER, GAP, LO, HI);
    expect(drawn).toEqual([126, 131, 136, 141]);
  });

  it('fans the finish line pack to the player’s left and keeps them on the strip', () => {
    const drawn = spreadHeads([HI, HI, HI, HI], PLAYER, GAP, LO, HI);
    expect(drawn[PLAYER]).toBe(HI);
    expect(Math.max(...drawn)).toBe(HI);
    expect(Math.min(...drawn)).toBeGreaterThanOrEqual(LO);
    expect(tightest(drawn)).toBeGreaterThanOrEqual(GAP);
  });

  it('answers in the order it was asked, whichever head is leading', () => {
    const drawn = spreadHeads([200, 198, 140, 199], 2, GAP, LO, HI);
    expect(drawn[2]).toBe(140);
    expect(drawn[0]).toBeGreaterThan(drawn[3] ?? 0);
    expect(drawn[3]).toBeGreaterThan(drawn[1] ?? 0);
    expect(tightest(drawn)).toBeGreaterThanOrEqual(GAP);
  });
});
