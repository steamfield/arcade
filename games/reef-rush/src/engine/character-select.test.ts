import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS } from '../logic/types.ts';
import { DISPLAY_FACE, measureText, TEXT_FACE } from './art/ui/typeface.ts';
import { abilityTextFor, CARD_TEXT_WIDTH, moveCharacter } from './character-select.ts';
import { racerName } from './view/race-text.ts';

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

describe('the character card', () => {
  it('names Nib and Selene by their abilities', () => {
    expect(abilityTextFor('nib')).toEqual({ name: 'DEEP POCKETS', blurb: 'HOLDS 4 POWER-UPS, NOT 3' });
    expect(abilityTextFor('selene')).toEqual({ name: 'MOONLIGHT', blurb: 'SEES IN DARK, NO STINGS' });
  });

  it.each(CHARACTER_IDS)('fits every line for %s in the text column beside the portrait', (character) => {
    const { name, blurb } = abilityTextFor(character);
    const widths = {
      fullName: measureText(DISPLAY_FACE, racerName(character).toUpperCase()).width,
      ability: measureText(TEXT_FACE, name).width,
      blurb: measureText(TEXT_FACE, blurb).width,
    };
    for (const [line, width] of Object.entries(widths)) {
      expect(width, `${character} ${line}`).toBeLessThanOrEqual(CARD_TEXT_WIDTH);
    }
  });
});
