import { describe, expect, it } from 'vitest';
import { moveCharacter } from './character-select.ts';

describe('the select grid cursor', () => {
  it('moves along a row and down a column of the four-wide grid', () => {
    expect(moveCharacter('rudy', 1, 0)).toBe('gil');
    expect(moveCharacter('gil', 0, 1)).toBe('baron');
    expect(moveCharacter('baron', -1, 0)).toBe('nib');
    expect(moveCharacter('nib', 0, -1)).toBe('rudy');
  });

  it('wraps at every edge', () => {
    expect(moveCharacter('onyx', 1, 0)).toBe('rudy');
    expect(moveCharacter('rudy', -1, 0)).toBe('onyx');
    expect(moveCharacter('rook', 1, 0)).toBe('nib');
    expect(moveCharacter('streak', 0, -1)).toBe('selene');
    expect(moveCharacter('selene', 0, 1)).toBe('streak');
  });
});
