import { describe, expect, it } from 'vitest';
import { captureTicks } from './attract.ts';
import { UsageError } from './games.ts';

describe('which ticks arcade attract records', () => {
  it('captures every Nth tick from the first to the last, inclusive', () => {
    expect(captureTicks({ scenario: 'x', from: 150, to: 162, every: 3 }).loop).toEqual([150, 153, 156, 159, 162]);
  });

  it('records at 20 fps of game time by default', () => {
    expect(captureTicks({ scenario: 'x', from: 0, to: 9 }).loop).toEqual([0, 3, 6, 9]);
  });

  it('takes the cover from the middle of the loop unless one is named', () => {
    expect(captureTicks({ scenario: 'x', from: 0, to: 12, every: 3 }).cover).toBe(6);
    expect(captureTicks({ scenario: 'x', from: 0, to: 12, every: 3, cover: 1500 }).cover).toBe(1500);
  });

  it('rejects an empty or backwards range and a zero step', () => {
    expect(() => captureTicks({ scenario: 'x', from: 10, to: 10 })).toThrow(UsageError);
    expect(() => captureTicks({ scenario: 'x', from: 20, to: 10 })).toThrow(UsageError);
    expect(() => captureTicks({ scenario: 'x', from: 0, to: 10, every: 0 })).toThrow(UsageError);
  });
});
