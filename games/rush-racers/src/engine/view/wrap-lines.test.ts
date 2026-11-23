import { describe, expect, it } from 'vitest';
import { wrapLines } from './wrap-lines.ts';

describe('wrapping a notice into short lines', () => {
  it('breaks a 40-character notice at spaces into lines of at most 11', () => {
    const notice = 'ROOMS ARE NOT AVAILABLE, TRY AGAIN LATER';
    expect(notice).toHaveLength(40);
    expect(wrapLines(notice, 11)).toEqual(['ROOMS ARE', 'NOT', 'AVAILABLE,', 'TRY AGAIN', 'LATER']);
  });

  it('needs six lines at most for 40 characters at 11, when every pair of words just misses', () => {
    expect(wrapLines('HOSTS GAVEUP ROOMS CLOSED AGAIN SORRY!', 11)).toEqual([
      'HOSTS',
      'GAVEUP',
      'ROOMS',
      'CLOSED',
      'AGAIN',
      'SORRY!',
    ]);
  });

  it('keeps a line that fits whole', () => {
    expect(wrapLines('LINK COPIED', 11)).toEqual(['LINK COPIED']);
  });

  it('splits a word longer than a line across lines', () => {
    expect(wrapLines('A RECONNECTING NOW', 5)).toEqual(['A', 'RECON', 'NECTI', 'NG', 'NOW']);
  });

  it('gives no lines for empty or blank text, and collapses runs of spaces', () => {
    expect(wrapLines('', 11)).toEqual([]);
    expect(wrapLines('   ', 11)).toEqual([]);
    expect(wrapLines('ROOM  IS   FULL', 11)).toEqual(['ROOM IS', 'FULL']);
  });

  it('refuses a line length below one character', () => {
    expect(() => wrapLines('ROOM', 0)).toThrow('wrapLines needs a line length of at least 1 whole character; got 0');
  });
});
