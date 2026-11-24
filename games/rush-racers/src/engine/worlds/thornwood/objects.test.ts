/**
 * Thornwood's own object rows: the words it uses for items, enemies and pickups. What every
 * world's object art shares is checked in `worlds/skins.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { THORNWOOD_OBJECTS } from './objects.ts';

describe('Thornwood object words', () => {
  it('words items, enemies and pickups the Thornwood way', () => {
    const { text } = THORNWOOD_OBJECTS;
    expect(text.attackCaptions).toEqual({
      homingSquid: 'BEE',
      riptide: 'TAILWIND',
      undertow: 'SNARE VINE',
      mimic: 'COPYCAT',
    });
    expect(text.enemyCaptions).toEqual({
      crab: 'BEETLE WALKS',
      shark: 'BOAR CHARGES',
      eel: 'SNAKE LUNGES',
    });
    expect([text.cratesHeading, text.pearlsHeading, text.slowedBy, text.trapped]).toEqual([
      'HIT CRATES',
      'GRAB ACORNS',
      'SLOWED BY MUD',
      'SAP',
    ]);
  });
});
